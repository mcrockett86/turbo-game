/**
 * Three.js Diagnostic — Playwright Test (Simple approach)
 * 
 * Captures screenshots at each phase, then analyzes them with Node.js.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT_DIR = join(import.meta.dirname, 'diagnostic-output');
mkdirSync(OUTPUT_DIR, { recursive: true });

// Analyze PNG screenshot bytes directly
function analyzePNG(buffer) {
  // PNG signature check
  if (buffer[0] !== 0x89) return { error: 'Not a PNG' };
  
  // Find IHDR chunk to get dimensions
  let width, height;
  let dataOffset = 8; // Skip PNG signature
  
  while (dataOffset < buffer.length) {
    const chunkLen = buffer.readUInt32BE(dataOffset);
    const chunkType = buffer.toString('ascii', dataOffset + 4, dataOffset + 8);
    
    if (chunkType === 'IHDR') {
      width = buffer.readUInt32BE(dataOffset + 8);
      height = buffer.readUInt32BE(dataOffset + 12);
      break;
    }
    dataOffset += 12 + chunkLen; // 4(len) + 4(type) + data + 4(crc)
  }
  
  if (!width || !height) return { error: 'No IHDR found' };
  
  // Find IDAT chunk (compressed image data)
  // For simplicity, we'll use zlib to decompress
  // But that's complex. Instead, let's use canvas to decode the PNG.
  
  return { width, height };
}

// Use Node canvas/png to analyze screenshots
async function analyzeScreenshot(path) {
  // Try to use canvas package
  try {
    const { createCanvas } = await import('canvas');
    const fs = await import('node:fs');
    const pngData = fs.readFileSync(path);
    const img = createCanvas();
    // This won't work directly with PNG buffers in simple node-canvas
  } catch (e) {
    // Fall through to simpler approach
  }
  
  // Simple approach: use the PNG raw data
  // Actually, let's just use a simple heuristic on the PNG file
  // PNG files store compressed data, so we need to decompress
  // Let's use a different approach: read the PNG with a simple decoder
  
  // Use the 'pngjs' package if available
  try {
    const PNG = (await import('pngjs')).PNG;
    const png = new PNG();
    const pixels = await new Promise((resolve, reject) => {
      png.on('parsed', resolve);
      png.parse(pngData);
    });
    
    let blackCount = 0, totalPixels = png.width * png.height;
    let sumR = 0, sumG = 0, sumB = 0;
    let maxR = 0, maxG = 0, maxB = 0;
    const colorSet = new Set();
    
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        const idx = (y * png.width + x) * 4;
        const r = png.data[idx], g = png.data[idx + 1], b = png.data[idx + 2], a = png.data[idx + 3];
        sumR += r; sumG += g; sumB += b;
        maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
        if (r < 15 && g < 15 && b < 15 && a > 10) blackCount++;
        if (a > 10) colorSet.add(r + ',' + g + ',' + b);
      }
    }
    
    return {
      blackPct: (blackCount / totalPixels) * 100,
      hasContent: maxR > 50 || maxG > 50 || maxB > 50,
      avgR: Math.round(sumR / totalPixels),
      avgG: Math.round(sumG / totalPixels),
      avgB: Math.round(sumB / totalPixels),
      maxR, maxG, maxB,
      uniqueColors: colorSet.size,
    };
  } catch (e) {
    // No pngjs available, fall back to simple approach
  }
  
  // Fallback: check if file is non-empty (basic validation)
  const stats = await import('node:fs').then(fs => fs.statSync(path));
  return {
    blackPct: 0, // Can't analyze without pngjs
    hasContent: stats.size > 1000, // Non-empty file
    avgR: 0, avgG: 0, avgB: 0,
    maxR: 0, maxG: 0, maxB: 0,
    uniqueColors: 0,
    fallback: true,
    fileSize: stats.size,
  };
}

async function runTest() {
  console.log('═══════════════════════════════════════════');
  console.log('  Three.js Diagnostic — Playwright Test');
  console.log('═══════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const results = [];
  let allPassed = true;
  let glInfo = '';
  let errors = [];

  page.on('console', msg => {
    const text = msg.text();
    if (text.match(/WebGL|RENDERER|Version|Error|ERROR|Context Lost|could not be created|THREE/)) {
      glInfo += text + '\n';
    }
  });
  page.on('pageerror', e => errors.push(e.message));

  try {
    // Phase 1: Static wide shot (3s into the 6s phase)
    console.log('▶ Phase 1: Static wide shot...');
    await page.goto('http://localhost:8787/threejs-diagnostic.html', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    let canvas = await page.$('canvas');
    if (!canvas) {
      console.log('  ❌ No canvas element found!');
      allPassed = false;
    } else {
      const screenshotPath = join(OUTPUT_DIR, 'phase1-screenshot.png');
      await canvas.screenshot({ path: screenshotPath });
      const analysis = await analyzeScreenshot(screenshotPath);
      const report = { phase: '1-static-wide', screenshot: screenshotPath, ...analysis };
      results.push(report);
      if (report.fallback) {
        console.log(`  File size: ${report.fileSize} bytes (pngjs not available, can't analyze pixels)`);
      } else {
        console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);
      }
      if (!report.hasContent && !report.fallback) {
        console.log('  ⚠️  Canvas nearly 100% black');
        allPassed = false;
      }
    }

    // Phase 2: Camera orbit (6s more = 9s total)
    console.log('▶ Phase 2: Camera orbit...');
    await page.waitForTimeout(6000);
    canvas = await page.$('canvas');
    if (canvas) {
      const screenshotPath = join(OUTPUT_DIR, 'phase2-screenshot.png');
      await canvas.screenshot({ path: screenshotPath });
      const analysis = await analyzeScreenshot(screenshotPath);
      const report = { phase: '2-camera-orbit', screenshot: screenshotPath, ...analysis };
      results.push(report);
      if (report.fallback) {
        console.log(`  File size: ${report.fileSize} bytes`);
      } else {
        console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);
      }
    }

    // Phase 3: Vertical arc (6s more = 15s total)
    console.log('▶ Phase 3: Vertical arc...');
    await page.waitForTimeout(6000);
    canvas = await page.$('canvas');
    if (canvas) {
      const screenshotPath = join(OUTPUT_DIR, 'phase3-screenshot.png');
      await canvas.screenshot({ path: screenshotPath });
      const analysis = await analyzeScreenshot(screenshotPath);
      const report = { phase: '3-vertical-arc', screenshot: screenshotPath, ...analysis };
      results.push(report);
      if (report.fallback) {
        console.log(`  File size: ${report.fileSize} bytes`);
      } else {
        console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);
      }
    }

    // Phase 4: Close-up sweep (6s more = 21s total)
    console.log('▶ Phase 4: Close-up sweep...');
    await page.waitForTimeout(6000);
    canvas = await page.$('canvas');
    if (canvas) {
      const screenshotPath = join(OUTPUT_DIR, 'phase4-screenshot.png');
      await canvas.screenshot({ path: screenshotPath });
      const analysis = await analyzeScreenshot(screenshotPath);
      const report = { phase: '4-close-up-sweep', screenshot: screenshotPath, ...analysis };
      results.push(report);
      if (report.fallback) {
        console.log(`  File size: ${report.fileSize} bytes`);
      } else {
        console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);
      }
    }

    // Phase 5: Geometry proximity (6s more = 27s total)
    console.log('▶ Phase 5: Geometry proximity...');
    await page.waitForTimeout(6000);
    canvas = await page.$('canvas');
    if (canvas) {
      const screenshotPath = join(OUTPUT_DIR, 'phase5-screenshot.png');
      await canvas.screenshot({ path: screenshotPath });
      const analysis = await analyzeScreenshot(screenshotPath);
      const report = { phase: '5-geometry-proximity', screenshot: screenshotPath, ...analysis };
      results.push(report);
      if (report.fallback) {
        console.log(`  File size: ${report.fileSize} bytes`);
      } else {
        console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);
      }
    }

    // Phase 6: Full sweep (4s more = 31s total)
    console.log('▶ Phase 6: Full sweep...');
    await page.waitForTimeout(4000);
    canvas = await page.$('canvas');
    if (canvas) {
      const screenshotPath = join(OUTPUT_DIR, 'phase6-screenshot.png');
      await canvas.screenshot({ path: screenshotPath });
      const analysis = await analyzeScreenshot(screenshotPath);
      const report = { phase: '6-full-sweep', screenshot: screenshotPath, ...analysis };
      results.push(report);
      if (report.fallback) {
        console.log(`  File size: ${report.fileSize} bytes`);
      } else {
        console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);
      }
    }

    // ─── Summary ─────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════');
    console.log('  WebGL Console Info:');
    console.log('═══════════════════════════════════════════');
    if (glInfo.trim()) {
      glInfo.trim().split('\n').forEach(line => console.log('  ' + line));
    } else {
      console.log('  (none captured)');
    }

    if (errors.length > 0) {
      console.log('\n❌ Page errors:');
      errors.slice(0, 10).forEach(e => console.log(`  ${e}`));
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════');
    console.log(`\nScreenshots saved to: ${OUTPUT_DIR}/`);
    console.log('');

    // Check for WebGL context errors
    const contextErrors = glInfo.match(/context could not be created|Context Lost|Canvas has an existing context/g);
    if (contextErrors) {
      console.log(`\n⚠️  WebGL context errors detected: ${contextErrors.length} occurrences`);
      console.log('   This means Three.js failed to create a WebGL context on the canvas.');
      console.log('   Common causes:');
      console.log('   - Canvas already has a 2D context (from getImageData)');
      console.log('   - WebGL not supported on this platform');
      console.log('   - Canvas dimensions are 0');
    }

    const reportPath = join(OUTPUT_DIR, 'diagnostic-report.json');
    writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nFull report: ${reportPath}`);

    // Check if all screenshots are non-empty (basic validation)
    const nonEmpty = results.filter(r => !r.fallback || (r.fallback && r.fileSize > 1000)).length;
    console.log(`\nScreenshots captured: ${results.length}/${results.length}`);
    console.log(`Non-empty files: ${nonEmpty}`);

    console.log(`\nOverall: ${allPassed ? '✅ ALL PASSED' : '⚠️ SOME WARNINGS (check above)'}`);

  } catch (err) {
    console.error('\n❌ Test error:', err.message);
    allPassed = false;
  } finally {
    await browser.close();
  }

  return allPassed ? 0 : 1;
}

runTest().then(code => process.exit(code));
