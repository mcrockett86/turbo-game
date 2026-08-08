/**
 * Three.js Diagnostic — Playwright Test
 * 
 * Opens the diagnostic HTML, captures screenshots at each phase,
 * validates canvas pixels are NOT all black, and reports results.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(__dirname, 'diagnostic-output');
mkdirSync(OUTPUT_DIR, { recursive: true });

function analyzeCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blackPct: 100, hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0, uniqueColors: 0 };

  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let blackCount = 0;
  let totalPixels = w * h;
  let sumR = 0, sumG = 0, sumB = 0;
  let maxR = 0, maxG = 0, maxB = 0;
  const colorSet = new Set<string>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    sumR += r; sumG += g; sumB += b;
    maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
    if (r < 15 && g < 15 && b < 15 && a > 10) blackCount++;
    if (a > 10) colorSet.add(`${r},${g},${b}`);
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
}

async function runTest() {
  console.log('═══════════════════════════════════════════');
  console.log('  Three.js Diagnostic — Playwright Test');
  console.log('═══════════════════════════════════════════\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const results: any[] = [];
  let allPassed = true;

  try {
    // Phase 1: Static wide shot (waits 3s into the 6s phase)
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
      const analysis = await page.evaluate((el) => analyzeCanvas(el as HTMLCanvasElement), canvas);
      const report = { phase: '1-static-wide', screenshot: screenshotPath, ...analysis };
      results.push(report);
      console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);

      if (report.blackPct >= 99) {
        console.log('  ⚠️  WARNING: Canvas is nearly 100% black');
        allPassed = false;
      }
      if (!report.hasContent) {
        console.log('  ❌ FAIL: No colored content detected');
        allPassed = false;
      }
    }

    // Phase 2: Camera orbit (wait 6s more = 9s total)
    console.log('▶ Phase 2: Camera orbit...');
    await page.waitForTimeout(6000);

    canvas = await page.$('canvas');
    if (canvas) {
      const screenshotPath = join(OUTPUT_DIR, 'phase2-screenshot.png');
      await canvas.screenshot({ path: screenshotPath });
      const analysis = await page.evaluate((el) => analyzeCanvas(el as HTMLCanvasElement), canvas);
      const report = { phase: '2-camera-orbit', screenshot: screenshotPath, ...analysis };
      results.push(report);
      console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);

      if (report.blackPct >= 99) {
        console.log('  ⚠️  WARNING: Canvas is nearly 100% black');
        allPassed = false;
      }
    }

    // Phase 3: Vertical arc (wait 6s more = 15s total)
    console.log('▶ Phase 3: Vertical arc...');
    await page.waitForTimeout(6000);

    canvas = await page.$('canvas');
    if (canvas) {
      const screenshotPath = join(OUTPUT_DIR, 'phase3-screenshot.png');
      await canvas.screenshot({ path: screenshotPath });
      const analysis = await page.evaluate((el) => analyzeCanvas(el as HTMLCanvasElement), canvas);
      const report = { phase: '3-vertical-arc', screenshot: screenshotPath, ...analysis };
      results.push(report);
      console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);

      if (report.blackPct >= 99) {
        console.log('  ⚠️  WARNING: Canvas is nearly 100% black');
        allPassed = false;
      }
    }

    // Phase 4: Close-up sweep (wait 6s more = 21s total)
    console.log('▶ Phase 4: Close-up sweep...');
    await page.waitForTimeout(6000);

    canvas = await page.$('canvas');
    if (canvas) {
      const screenshotPath = join(OUTPUT_DIR, 'phase4-screenshot.png');
      await canvas.screenshot({ path: screenshotPath });
      const analysis = await page.evaluate((el) => analyzeCanvas(el as HTMLCanvasElement), canvas);
      const report = { phase: '4-close-up-sweep', screenshot: screenshotPath, ...analysis };
      results.push(report);
      console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);

      if (report.blackPct >= 99) {
        console.log('  ⚠️  WARNING: Canvas is nearly 100% black');
        allPassed = false;
      }
    }

    // Phase 5: Geometry proximity (wait 6s more = 27s total)
    console.log('▶ Phase 5: Geometry proximity...');
    await page.waitForTimeout(6000);

    canvas = await page.$('canvas');
    if (canvas) {
      const screenshotPath = join(OUTPUT_DIR, 'phase5-screenshot.png');
      await canvas.screenshot({ path: screenshotPath });
      const analysis = await page.evaluate((el) => analyzeCanvas(el as HTMLCanvasElement), canvas);
      const report = { phase: '5-geometry-proximity', screenshot: screenshotPath, ...analysis };
      results.push(report);
      console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);

      if (report.blackPct >= 99) {
        console.log('  ⚠️  WARNING: Canvas is nearly 100% black');
        allPassed = false;
      }
    }

    // Phase 6: Full sweep (wait 4s more = 31s total)
    console.log('▶ Phase 6: Full sweep...');
    await page.waitForTimeout(4000);

    canvas = await page.$('canvas');
    if (canvas) {
      const screenshotPath = join(OUTPUT_DIR, 'phase6-screenshot.png');
      await canvas.screenshot({ path: screenshotPath });
      const analysis = await page.evaluate((el) => analyzeCanvas(el as HTMLCanvasElement), canvas);
      const report = { phase: '6-full-sweep', screenshot: screenshotPath, ...analysis };
      results.push(report);
      console.log(`  Black: ${report.blackPct.toFixed(1)}% | Content: ${report.hasContent} | Avg: rgb(${report.avgR},${report.avgG},${report.avgB}) | Max: rgb(${report.maxR},${report.maxG},${report.maxB}) | Unique: ${report.uniqueColors}`);

      if (report.blackPct >= 99) {
        console.log('  ⚠️  WARNING: Canvas is nearly 100% black');
        allPassed = false;
      }
    }

    // ─── Summary ─────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════');
    console.log(`\nScreenshots saved to: ${OUTPUT_DIR}/`);
    console.log('');

    // Check if colors change between phases (camera movement is working)
    if (results.length >= 2) {
      const colorChange = results[0].uniqueColors !== results[results.length - 1].uniqueColors;
      const avgColorChange = Math.abs(results[0].avgR - results[results.length - 1].avgR) +
                             Math.abs(results[0].avgG - results[results.length - 1].avgG) +
                             Math.abs(results[0].avgB - results[results.length - 1].avgB);
      console.log(`Color variety changed between phases: ${colorChange ? 'YES' : 'NO'}`);
      console.log(`Average color delta: ${avgColorChange}`);
      if (avgColorChange > 20) {
        console.log('✅ Camera movement is producing different views');
      } else {
        console.log('⚠️  Minimal color change — camera may not be moving or scene is static');
      }
    }

    // Check WebGL errors in console
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('WebGL') || text.includes('WebGL2') || text.includes('RENDERER') || text.includes('Version') || text.includes('Error') || text.includes('ERROR')) {
        logs.push(text);
      }
    });

    // Save JSON report
    const reportPath = join(OUTPUT_DIR, 'diagnostic-report.json');
    writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nFull report: ${reportPath}`);

    console.log(`\nOverall: ${allPassed ? '✅ ALL PASSED' : '⚠️ SOME WARNINGS (check above)'}`);

  } catch (err: any) {
    console.error('\n❌ Test error:', err.message);
    allPassed = false;
  } finally {
    await browser.close();
  }

  return allPassed ? 0 : 1;
}

runTest().then(code => process.exit(code));
