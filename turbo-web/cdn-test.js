/**
 * Check if Three.js CDN module loads in headless Chromium
 */
import { chromium } from 'playwright';

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  const logs = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));

  // Test 1: Can we fetch the Three.js module directly?
  console.log('▶ Test 1: Fetching Three.js module URL...');
  try {
    const resp = await page.evaluate(async () => {
      try {
        const r = await fetch('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js');
        return { status: r.status, ok: r.ok, contentType: r.headers.get('content-type') };
      } catch (e) { return { error: e.message }; }
    });
    console.log('  Response:', JSON.stringify(resp));
  } catch (e) {
    console.log('  ❌ Fetch error:', e.message);
  }

  // Test 2: Importmap resolution
  console.log('\n▶ Test 2: Importmap resolution...');
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <script type="importmap">
      {
        "imports": {
          "three": "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js"
        }
      }
      </script>
    </head>
    <body>
      <script type="module">
        console.log('Module script started');
        try {
          const THREE = await import('three');
          console.log('✅ Three.js loaded successfully');
          console.log('THREE.Scene:', typeof THREE.Scene);
          console.log('THREE.WebGLRenderer:', typeof THREE.WebGLRenderer);
          window.threeLoaded = true;
          window.threeVersion = THREE?.version || 'unknown';
        } catch (e) {
          console.log('❌ Three.js import failed:', e.message);
          window.threeLoaded = false;
          window.threeError = e.message;
        }
      </script>
    </body>
    </html>
  `, { waitUntil: 'networkidle', timeout: 15000 });

  await page.waitForTimeout(3000);

  // Check if Three.js loaded
  const threeLoaded = await page.evaluate(() => window.threeLoaded);
  const threeVersion = await page.evaluate(() => window.threeVersion);
  const threeError = await page.evaluate(() => window.threeError);
  
  console.log(`  Three.js loaded: ${threeLoaded}`);
  console.log(`  Version: ${threeVersion}`);
  if (threeError) console.log(`  Error: ${threeError}`);

  // Check console logs
  console.log('\n▶ Console logs:');
  logs.forEach(l => console.log(`  [${l.type}] ${l.text}`));

  // Check errors
  if (errors.length > 0) {
    console.log('\n▶ Page errors:');
    errors.forEach(e => console.log(`  ❌ ${e}`));
  }

  // Test 3: Try the diagnostic HTML
  console.log('\n▶ Test 3: Loading diagnostic HTML...');
  errors.length = 0;
  logs.length = 0;
  
  await page.goto('http://localhost:8787/threejs-diagnostic.html', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(5000);

  const canvasExists = await page.$('canvas');
  const canvasSize = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return { width: c?.width, height: c?.height, style: c?.getAttribute('style') };
  });
  console.log(`  Canvas exists: ${!!canvasExists}`);
  console.log(`  Canvas size: ${canvasSize.width}x${canvasSize.height}`);
  console.log(`  Canvas style: ${canvasSize.style}`);

  const glAvailable = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return false;
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
  console.log(`  WebGL available: ${glAvailable}`);

  // Check for Three.js global
  const threeGlobal = await page.evaluate(() => typeof window.THREE);
  console.log(`  window.THREE type: ${threeGlobal}`);

  // Check console for Three.js logs
  const threeLogs = logs.filter(l => l.text.includes('THREE') || l.text.includes('WebGL') || l.text.includes('RENDERER'));
  if (threeLogs.length > 0) {
    console.log('\n▶ Three.js/WebGL logs:');
    threeLogs.forEach(l => console.log(`  [${l.type}] ${l.text}`));
  }

  // Errors
  if (errors.length > 0) {
    console.log('\n▶ Page errors:');
    errors.forEach(e => console.log(`  ❌ ${e}`));
  }

  // Take screenshot
  await page.screenshot({ path: '/home/manager/turbo-game/turbo-web/diagnostic-output/deep-diag-screenshot.png' });
  console.log('\n  Screenshot: diagnostic-output/deep-diag-screenshot.png');

  await browser.close();
}

runTest();
