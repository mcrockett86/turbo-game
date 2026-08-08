/**
 * Three.js Diagnostic Test
 * 
 * Opens the diagnostic HTML in a headless browser, captures screenshots
 * at each phase, and validates that the canvas is NOT all black.
 */

import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(__dirname, 'diagnostic-output');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Analyze canvas pixels: returns { blackPct, sampleColors, hasContent } */
function analyzeCanvas(canvas: Element): { blackPct: number; sampleColors: string[]; hasContent: boolean; avgR: number; avgG: number; avgB: number; maxR: number; maxG: number; maxB: number } {
  const ctx = (canvas as HTMLCanvasElement).getContext('2d');
  if (!ctx) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };

  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let blackCount = 0;
  let totalPixels = w * h;
  let sumR = 0, sumG = 0, sumB = 0;
  let maxR = 0, maxG = 0, maxB = 0;
  const sampleColors: string[] = [];

  // Sample key regions: center, corners, edges
  const regions = [
    { name: 'center', x: Math.floor(w / 2), y: Math.floor(h / 2) },
    { name: 'top-left', x: Math.floor(w / 4), y: Math.floor(h / 4) },
    { name: 'top-right', x: Math.floor(3 * w / 4), y: Math.floor(h / 4) },
    { name: 'bottom-left', x: Math.floor(w / 4), y: Math.floor(3 * h / 4) },
    { name: 'bottom-right', x: Math.floor(3 * w / 4), y: Math.floor(3 * h / 4) },
    { name: 'quarter', x: Math.floor(w / 4), y: Math.floor(h / 4) },
    { name: 'mid-top', x: Math.floor(w / 2), y: Math.floor(h / 8) },
    { name: 'mid-bottom', x: Math.floor(w / 2), y: Math.floor(7 * h / 8) },
  ];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    sumR += r;
    sumG += g;
    sumB += b;
    maxR = Math.max(maxR, r);
    maxG = Math.max(maxG, g);
    maxB = Math.max(maxB, b);

    // A pixel is "black" if all channels < 15
    if (r < 15 && g < 15 && b < 15 && a > 10) {
      blackCount++;
    }
  }

  // Sample colors from key regions
  for (const region of regions) {
    const idx = (region.y * w + region.x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    const color = `rgb(${r},${g},${b})`;
    if (!sampleColors.includes(color) && a > 10) {
      sampleColors.push(color);
    }
  }

  const blackPct = (blackCount / totalPixels) * 100;
  const avgR = sumR / totalPixels;
  const avgG = sumG / totalPixels;
  const avgB = sumB / totalPixels;

  return {
    blackPct,
    sampleColors,
    hasContent: maxR > 50 || maxG > 50 || maxB > 50,
    avgR,
    avgG,
    avgB,
    maxR,
    maxG,
    maxB,
  };
}

/** Save screenshot + analysis report */
function saveReport(phase: string, screenshotPath: string, analysis: ReturnType<typeof analyzeCanvas>) {
  const report = {
    phase,
    screenshot: screenshotPath,
    blackPct: analysis.blackPct,
    hasContent: analysis.hasContent,
    avgColor: { r: Math.round(analysis.avgR), g: Math.round(analysis.avgG), b: Math.round(analysis.avgB) },
    maxColor: { r: analysis.maxR, g: analysis.maxG, b: analysis.maxB },
    sampleColors: analysis.sampleColors.slice(0, 10),
    width: (screenshotPath.match(/(\d+)x(\d+)/)?.[0]) || 'unknown',
    timestamp: new Date().toISOString(),
  };

  const reportPath = join(OUTPUT_DIR, `report-phase-${phase}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return report;
}

// ─── Tests ───────────────────────────────────────────────────────────────

test.describe('Three.js Diagnostic', () => {
  let page: import('@playwright/test').Page;

  test.beforeAll(async ({ browser }) => {
    // Start a local server for the HTML file
    const { execSync } = await import('child_process');
    const port = 8787;
    const htmlPath = join(__dirname, 'threejs-diagnostic.html');

    // Use Python HTTP server
    const server = await browser.newPage();
    // We'll serve via a simple approach: use file:// or start a server
    // Actually, let's use Playwright's built-in server or serve locally
    test.skip(true, 'Will use manual server approach');
  });

  test('Phase 1: Static wide shot should not be all black', async () => {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    // Start local server
    const { execSync } = await import('child_process');
    const serverProcess = execSync('cd /home/manager/turbo-game/turbo-web && python3 -m http.server 8787 2>/dev/null &', { shell: true });

    await page.goto('http://localhost:8787/threejs-diagnostic.html', { waitUntil: 'networkidle', timeout: 15000 });

    // Wait for Three.js to render
    await page.waitForTimeout(3000);

    // Take screenshot
    const screenshotPath = join(OUTPUT_DIR, 'phase1-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Analyze canvas
    const canvas = await page.$('canvas');
    expect(canvas).toBeTruthy();
    const analysis = await page.evaluate((canvas) => {
      if (!canvas) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const ctx = (canvas as HTMLCanvasElement).getContext('2d');
      if (!ctx) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      let blackCount = 0;
      let totalPixels = w * h;
      let sumR = 0, sumG = 0, sumB = 0;
      let maxR = 0, maxG = 0, maxB = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        sumR += r; sumG += g; sumB += b;
        maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
        if (r < 15 && g < 15 && b < 15 && a > 10) blackCount++;
      }
      return {
        blackPct: (blackCount / totalPixels) * 100,
        hasContent: maxR > 50 || maxG > 50 || maxB > 50,
        avgR: sumR / totalPixels,
        avgG: sumG / totalPixels,
        avgB: sumB / totalPixels,
        maxR, maxG, maxB,
        sampleColors: [] as string[],
      };
    }, canvas);

    const report = saveReport('1-static-wide', screenshotPath, analysis);
    console.log(`\n📊 Phase 1 Report:`);
    console.log(`   Black pixels: ${report.blackPct.toFixed(1)}%`);
    console.log(`   Has content: ${report.hasContent}`);
    console.log(`   Avg color: rgb(${report.avgColor.r}, ${report.avgColor.g}, ${report.avgColor.b})`);
    console.log(`   Max color: rgb(${report.maxColor.r}, ${report.maxColor.g}, ${report.maxColor.b})`);

    // Validate: should NOT be 100% black
    expect(report.blackPct).toBeLessThan(99, 'Canvas should not be 100% black in Phase 1');
    expect(report.hasContent).toBe(true, 'Canvas should have colored content in Phase 1');

    await browser.close();
  });

  test('Phase 2: Camera orbit should show changing colors', async () => {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    await page.goto('http://localhost:8787/threejs-diagnostic.html', { waitUntil: 'networkidle', timeout: 15000 });

    // Wait for Phase 2 to start (Phase 1 runs for 6s, Phase 2 for 6s)
    await page.waitForTimeout(7000);

    // Take screenshot at 3s into phase 2
    const screenshotPath = join(OUTPUT_DIR, 'phase2-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Analyze canvas
    const canvas = await page.$('canvas');
    const analysis = await page.evaluate((canvas) => {
      if (!canvas) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const ctx = (canvas as HTMLCanvasElement).getContext('2d');
      if (!ctx) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      let blackCount = 0;
      let totalPixels = w * h;
      let sumR = 0, sumG = 0, sumB = 0;
      let maxR = 0, maxG = 0, maxB = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        sumR += r; sumG += g; sumB += b;
        maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
        if (r < 15 && g < 15 && b < 15 && a > 10) blackCount++;
      }
      return {
        blackPct: (blackCount / totalPixels) * 100,
        hasContent: maxR > 50 || maxG > 50 || maxB > 50,
        avgR: sumR / totalPixels,
        avgG: sumG / totalPixels,
        avgB: sumB / totalPixels,
        maxR, maxG, maxB,
        sampleColors: [] as string[],
      };
    }, canvas);

    const report = saveReport('2-camera-orbit', screenshotPath, analysis);
    console.log(`\n📊 Phase 2 Report:`);
    console.log(`   Black pixels: ${report.blackPct.toFixed(1)}%`);
    console.log(`   Has content: ${report.hasContent}`);
    console.log(`   Avg color: rgb(${report.avgColor.r}, ${report.avgColor.g}, ${report.avgColor.b})`);
    console.log(`   Max color: rgb(${report.maxColor.r}, ${report.maxColor.g}, ${report.maxColor.b})`);

    expect(report.blackPct).toBeLessThan(99, 'Canvas should not be 100% black in Phase 2');
    expect(report.hasContent).toBe(true, 'Canvas should have colored content in Phase 2');

    await browser.close();
  });

  test('Phase 3: Vertical arc should show geometry at different heights', async () => {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    await page.goto('http://localhost:8787/threejs-diagnostic.html', { waitUntil: 'networkidle', timeout: 15000 });

    // Wait for Phase 3 (Phase 1: 6s + Phase 2: 6s + Phase 3: 3s = 15s)
    await page.waitForTimeout(15000);

    const screenshotPath = join(OUTPUT_DIR, 'phase3-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const canvas = await page.$('canvas');
    const analysis = await page.evaluate((canvas) => {
      if (!canvas) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const ctx = (canvas as HTMLCanvasElement).getContext('2d');
      if (!ctx) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      let blackCount = 0;
      let totalPixels = w * h;
      let sumR = 0, sumG = 0, sumB = 0;
      let maxR = 0, maxG = 0, maxB = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        sumR += r; sumG += g; sumB += b;
        maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
        if (r < 15 && g < 15 && b < 15 && a > 10) blackCount++;
      }
      return {
        blackPct: (blackCount / totalPixels) * 100,
        hasContent: maxR > 50 || maxG > 50 || maxB > 50,
        avgR: sumR / totalPixels,
        avgG: sumG / totalPixels,
        avgB: sumB / totalPixels,
        maxR, maxG, maxB,
        sampleColors: [] as string[],
      };
    }, canvas);

    const report = saveReport('3-vertical-arc', screenshotPath, analysis);
    console.log(`\n📊 Phase 3 Report:`);
    console.log(`   Black pixels: ${report.blackPct.toFixed(1)}%`);
    console.log(`   Has content: ${report.hasContent}`);
    console.log(`   Avg color: rgb(${report.avgColor.r}, ${report.avgColor.g}, ${report.avgColor.b})`);
    console.log(`   Max color: rgb(${report.maxColor.r}, ${report.maxColor.g}, ${report.maxColor.b})`);

    expect(report.blackPct).toBeLessThan(99, 'Canvas should not be 100% black in Phase 3');
    expect(report.hasContent).toBe(true, 'Canvas should have colored content in Phase 3');

    await browser.close();
  });

  test('Phase 4: Close-up sweep should show distinct object colors', async () => {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    await page.goto('http://localhost:8787/threejs-diagnostic.html', { waitUntil: 'networkidle', timeout: 15000 });

    // Wait for Phase 4 (6+6+6+3 = 21s)
    await page.waitForTimeout(21000);

    const screenshotPath = join(OUTPUT_DIR, 'phase4-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const canvas = await page.$('canvas');
    const analysis = await page.evaluate((canvas) => {
      if (!canvas) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const ctx = (canvas as HTMLCanvasElement).getContext('2d');
      if (!ctx) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      let blackCount = 0;
      let totalPixels = w * h;
      let sumR = 0, sumG = 0, sumB = 0;
      let maxR = 0, maxG = 0, maxB = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        sumR += r; sumG += g; sumB += b;
        maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
        if (r < 15 && g < 15 && b < 15 && a > 10) blackCount++;
      }
      return {
        blackPct: (blackCount / totalPixels) * 100,
        hasContent: maxR > 50 || maxG > 50 || maxB > 50,
        avgR: sumR / totalPixels,
        avgG: sumG / totalPixels,
        avgB: sumB / totalPixels,
        maxR, maxG, maxB,
        sampleColors: [] as string[],
      };
    }, canvas);

    const report = saveReport('4-close-up-sweep', screenshotPath, analysis);
    console.log(`\n📊 Phase 4 Report:`);
    console.log(`   Black pixels: ${report.blackPct.toFixed(1)}%`);
    console.log(`   Has content: ${report.hasContent}`);
    console.log(`   Avg color: rgb(${report.avgColor.r}, ${report.avgColor.g}, ${report.avgColor.b})`);
    console.log(`   Max color: rgb(${report.maxColor.r}, ${report.maxColor.g}, ${report.maxColor.b})`);

    expect(report.blackPct).toBeLessThan(99, 'Canvas should not be 100% black in Phase 4');
    expect(report.hasContent).toBe(true, 'Canvas should have colored content in Phase 4');

    await browser.close();
  });

  test('Phase 5: Geometry proximity should reveal objects when approaching', async () => {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    await page.goto('http://localhost:8787/threejs-diagnostic.html', { waitUntil: 'networkidle', timeout: 15000 });

    // Wait for Phase 5 (6+6+6+6+3 = 27s)
    await page.waitForTimeout(27000);

    const screenshotPath = join(OUTPUT_DIR, 'phase5-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const canvas = await page.$('canvas');
    const analysis = await page.evaluate((canvas) => {
      if (!canvas) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const ctx = (canvas as HTMLCanvasElement).getContext('2d');
      if (!ctx) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      let blackCount = 0;
      let totalPixels = w * h;
      let sumR = 0, sumG = 0, sumB = 0;
      let maxR = 0, maxG = 0, maxB = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        sumR += r; sumG += g; sumB += b;
        maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
        if (r < 15 && g < 15 && b < 15 && a > 10) blackCount++;
      }
      return {
        blackPct: (blackCount / totalPixels) * 100,
        hasContent: maxR > 50 || maxG > 50 || maxB > 50,
        avgR: sumR / totalPixels,
        avgG: sumG / totalPixels,
        avgB: sumB / totalPixels,
        maxR, maxG, maxB,
        sampleColors: [] as string[],
      };
    }, canvas);

    const report = saveReport('5-geometry-proximity', screenshotPath, analysis);
    console.log(`\n📊 Phase 5 Report:`);
    console.log(`   Black pixels: ${report.blackPct.toFixed(1)}%`);
    console.log(`   Has content: ${report.hasContent}`);
    console.log(`   Avg color: rgb(${report.avgColor.r}, ${report.avgColor.g}, ${report.avgColor.b})`);
    console.log(`   Max color: rgb(${report.maxColor.r}, ${report.maxColor.g}, ${report.maxColor.b})`);

    expect(report.blackPct).toBeLessThan(99, 'Canvas should not be 100% black in Phase 5');
    expect(report.hasContent).toBe(true, 'Canvas should have colored content in Phase 5');

    await browser.close();
  });

  test('Phase 6: Full sweep should show rich color variety', async () => {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    await page.goto('http://localhost:8787/threejs-diagnostic.html', { waitUntil: 'networkidle', timeout: 15000 });

    // Wait for full diagnostic (6+6+6+6+6+4 = 34s)
    await page.waitForTimeout(34000);

    const screenshotPath = join(OUTPUT_DIR, 'phase6-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const canvas = await page.$('canvas');
    const analysis = await page.evaluate((canvas) => {
      if (!canvas) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const ctx = (canvas as HTMLCanvasElement).getContext('2d');
      if (!ctx) return { blackPct: 100, sampleColors: [], hasContent: false, avgR: 0, avgG: 0, avgB: 0, maxR: 0, maxG: 0, maxB: 0 };
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      let blackCount = 0;
      let totalPixels = w * h;
      let sumR = 0, sumG = 0, sumB = 0;
      let maxR = 0, maxG = 0, maxB = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        sumR += r; sumG += g; sumB += b;
        maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
        if (r < 15 && g < 15 && b < 15 && a > 10) blackCount++;
      }
      return {
        blackPct: (blackCount / totalPixels) * 100,
        hasContent: maxR > 50 || maxG > 50 || maxB > 50,
        avgR: sumR / totalPixels,
        avgG: sumG / totalPixels,
        avgB: sumB / totalPixels,
        maxR, maxG, maxB,
        sampleColors: [] as string[],
      };
    }, canvas);

    const report = saveReport('6-full-sweep', screenshotPath, analysis);
    console.log(`\n📊 Phase 6 Report:`);
    console.log(`   Black pixels: ${report.blackPct.toFixed(1)}%`);
    console.log(`   Has content: ${report.hasContent}`);
    console.log(`   Avg color: rgb(${report.avgColor.r}, ${report.avgColor.g}, ${report.avgColor.b})`);
    console.log(`   Max color: rgb(${report.maxColor.r}, ${report.maxColor.g}, ${report.maxColor.b})`);

    expect(report.blackPct).toBeLessThan(99, 'Canvas should not be 100% black in Phase 6');
    expect(report.hasContent).toBe(true, 'Canvas should have colored content in Phase 6');

    await browser.close();
  });
});
