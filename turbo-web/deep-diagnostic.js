/**
 * Deep diagnostic — checks if Three.js is actually loaded and rendering
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT_DIR = join(import.meta.dirname, 'diagnostic-output');
mkdirSync(OUTPUT_DIR, { recursive: true });

async function runTest() {
  console.log('═══════════════════════════════════════════');
  console.log('  Three.js Deep Diagnostic');
  console.log('═══════════════════════════════════════════\n');

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-gpu-compositing', '--enable-features=VizDisplayCompositor']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // Collect all console output
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', err => {
    consoleLogs.push({ type: 'error', text: err.message });
  });

  try {
    console.log('▶ Loading diagnostic HTML...');
    await page.goto('http://localhost:8787/threejs-diagnostic.html', { waitUntil: 'networkidle', timeout: 15000 });
    
    console.log('▶ Checking DOM...');
    const domInfo = await page.evaluate(() => {
      return {
        canvasExists: !!document.querySelector('canvas'),
        canvasWidth: document.querySelector('canvas')?.width,
        canvasHeight: document.querySelector('canvas')?.height,
        canvasStyle: document.querySelector('canvas')?.getAttribute('style'),
        bodyChildCount: document.body.children.length,
        scriptCount: document.querySelectorAll('script').length,
      };
    });
    console.log('  DOM info:', JSON.stringify(domInfo, null, 2));

    console.log('▶ Checking Three.js global...');
    const threeInfo = await page.evaluate(() => {
      const checks = {};
      checks['window.THREE'] = typeof window.THREE !== 'undefined';
      checks['THREE.Scene'] = typeof THREE?.Scene !== 'undefined';
      checks['THREE.WebGLRenderer'] = typeof THREE?.WebGLRenderer !== 'undefined';
      checks['THREE.PerspectiveCamera'] = typeof THREE?.PerspectiveCamera !== 'undefined';
      checks['THREE.BoxGeometry'] = typeof THREE?.BoxGeometry !== 'undefined';
      checks['THREE.MeshStandardMaterial'] = typeof THREE?.MeshStandardMaterial !== 'undefined';
      checks['THREE.AmbientLight'] = typeof THREE?.AmbientLight !== 'undefined';
      checks['THREE.DirectionalLight'] = typeof THREE?.DirectionalLight !== 'undefined';
      checks['THREE.SphereGeometry'] = typeof THREE?.SphereGeometry !== 'undefined';
      checks['THREE.CylinderGeometry'] = typeof THREE?.CylinderGeometry !== 'undefined';
      checks['THREE.TorusGeometry'] = typeof THREE?.TorusGeometry !== 'undefined';
      checks['THREE.OctahedronGeometry'] = typeof THREE?.OctahedronGeometry !== 'undefined';
      checks['THREE.ConeGeometry'] = typeof THREE?.ConeGeometry !== 'undefined';
      checks['THREE.GridHelper'] = typeof THREE?.GridHelper !== 'undefined';
      checks['THREE.AxesHelper'] = typeof THREE?.AxesHelper !== 'undefined';
      checks['THREE.Fog'] = typeof THREE?.Fog !== 'undefined';
      checks['THREE.Color'] = typeof THREE?.Color !== 'undefined';
      checks['THREE.HemisphereLight'] = typeof THREE?.HemisphereLight !== 'undefined';
      checks['THREE.PointLight'] = typeof THREE?.PointLight !== 'undefined';
      checks['THREE.ACESFilmicToneMapping'] = typeof THREE?.ACESFilmicToneMapping !== 'undefined';
      checks['THREE.PCFSoftShadowMap'] = typeof THREE?.PCFSoftShadowMap !== 'undefined';
      return checks;
    });
    console.log('  Three.js availability:');
    let allGood = true;
    for (const [key, val] of Object.entries(threeInfo)) {
      const icon = val ? '✅' : '❌';
      if (!val) allGood = false;
      console.log(`    ${icon} ${key}: ${val}`);
    }

    console.log('▶ Waiting 5s for animation loop...');
    await page.waitForTimeout(5000);

    console.log('▶ Checking canvas pixels...');
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { exists: false };
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      
      // Check WebGL context
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const glInfo = gl ? {
        exists: true,
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        maxTexSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        vendor: gl.getParameter(gl.VENDOR),
      } : { exists: false };

      // Check canvas dimensions
      const rect = canvas.getBoundingClientRect();
      
      // Check for WebGL errors
      let glErrors = [];
      if (gl) {
        for (let i = 0; i < 10; i++) {
          const err = gl.getError();
          if (err !== 0) glErrors.push(err);
        }
      }

      // Sample pixels
      let blackCount = 0, total = w * h;
      let maxR = 0, maxG = 0, maxB = 0;
      const colorSet = new Set();
      if (ctx && w > 0 && h > 0) {
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          if (r < 15 && g < 15 && b < 15 && a > 10) blackCount++;
          maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
          if (a > 10) colorSet.add(r + ',' + g + ',' + b);
        }
      }

      return {
        exists: true,
        width: w,
        height: h,
        displayWidth: Math.round(rect.width),
        displayHeight: Math.round(rect.height),
        has2dContext: !!ctx,
        gl: glInfo,
        glErrors,
        blackPct: (blackCount / total) * 100,
        maxColor: { r: maxR, g: maxG, b: maxB },
        uniqueColors: colorSet.size,
        sampleColors: Array.from(colorSet).slice(0, 20),
      };
    });
    console.log('  Canvas info:', JSON.stringify(canvasInfo, null, 2));

    console.log('▶ Checking for Three.js renderer state...');
    const rendererInfo = await page.evaluate(() => {
      // Try to find any THREE.WebGLRenderer instances
      // Since we can't access internal state easily, check what's on the page
      const canvas = document.querySelector('canvas');
      if (!canvas) return { found: false };
      
      // Check if canvas has a WebGL context
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { found: false, reason: 'no WebGL context' };
      
      // Check canvas framebuffer status
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      const statusNames = {
        0x3042: 'FRAMEBUFFER_COMPLETE',
        0x3043: 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
        0x3044: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
        0x3045: 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS',
        0x3046: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
        0x3047: 'FRAMEBUFFER_INCOMPLETE_DRAW_BUFFER',
        0x3048: 'FRAMEBUFFER_INCOMPLETE_READ_BUFFER',
        0x3062: 'FRAMEBUFFER_UNSUPPORTED',
        0x8CDD: 'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE',
      };
      
      gl.deleteFramebuffer(fb);
      
      return {
        found: true,
        framebufferStatus: statusNames[status] || `unknown(${status})`,
        glRenderer: gl.getParameter(gl.RENDERER),
      };
    });
    console.log('  Renderer info:', JSON.stringify(rendererInfo, null, 2));

    // Save screenshots at different times
    for (let i = 0; i < 3; i++) {
      const sp = join(OUTPUT_DIR, `deep-diag-screenshot-${i}.png`);
      await page.screenshot({ path: sp, fullPage: false });
      console.log(`  Screenshot ${i}: ${sp}`);
    }

    // Check console for errors
    const errors = consoleLogs.filter(l => l.type === 'error' || l.text.includes('Error') || l.text.includes('error'));
    if (errors.length > 0) {
      console.log('\n❌ Errors found:');
      errors.forEach(e => console.log(`  ${e.text}`));
    }

    // Check for Three.js specific logs
    const threeLogs = consoleLogs.filter(l => l.text.includes('THREE') || l.text.includes('three'));
    if (threeLogs.length > 0) {
      console.log('\n📋 Three.js logs:');
      threeLogs.slice(0, 10).forEach(l => console.log(`  ${l.text}`));
    }

    // Check for WebGL warnings
    const webglWarnings = consoleLogs.filter(l => l.text.includes('WebGL') || l.text.includes('WebGL2'));
    if (webglWarnings.length > 0) {
      console.log('\n📋 WebGL logs:');
      webglWarnings.forEach(l => console.log(`  ${l.text}`));
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('  Deep Diagnostic Complete');
    console.log('═══════════════════════════════════════════');

    // Key findings
    console.log('\n📊 Key Findings:');
    if (!threeInfo['window.THREE']) {
      console.log('  ❌ THREE.js not loaded as global — importmap may have failed');
    }
    if (canvasInfo.width === 0 || canvasInfo.height === 0) {
      console.log('  ❌ Canvas dimensions are 0 — renderer never resized it');
    }
    if (!canvasInfo.gl.exists) {
      console.log('  ❌ No WebGL context on canvas');
    }
    if (canvasInfo.blackPct >= 99) {
      console.log('  ❌ Canvas is 100% black — scene not rendering');
    }
    if (canvasInfo.uniqueColors <= 1) {
      console.log('  ❌ Only ' + canvasInfo.uniqueColors + ' unique color(s) — likely just background or nothing');
    }
    if (rendererInfo.found && rendererInfo.framebufferStatus !== 'FRAMEBUFFER_COMPLETE') {
      console.log('  ❌ Framebuffer incomplete: ' + rendererInfo.framebufferStatus);
    }

  } catch (err) {
    console.error('\n❌ Test error:', err.message);
  } finally {
    await browser.close();
  }
}

runTest();
