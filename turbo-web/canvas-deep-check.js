/**
 * Check exactly what's happening with the Three.js canvas
 */
import { chromium } from 'playwright';

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  const logs = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));

  await page.goto('http://localhost:8787/threejs-diagnostic.html', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(8000);

  // Deep canvas inspection
  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };

    // Check WebGL context
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    
    // Check if canvas is being used by Three.js
    const checks = {};
    checks['canvasWidth'] = canvas.width;
    checks['canvasHeight'] = canvas.height;
    checks['displayWidth'] = canvas.clientWidth;
    checks['displayHeight'] = canvas.clientHeight;
    checks['styleDisplay'] = canvas.style.display;
    checks['styleVisibility'] = canvas.style.visibility;
    checks['styleOpacity'] = canvas.style.opacity;
    checks['stylePosition'] = canvas.style.position;
    checks['hasWebGL2'] = !!canvas.getContext('webgl2');
    checks['hasWebGL'] = !!canvas.getContext('webgl');
    checks['hasWebGLExperimental'] = !!canvas.getContext('experimental-webgl');
    
    if (gl) {
      checks['glRenderer'] = gl.getParameter(gl.RENDERER);
      checks['glVersion'] = gl.getParameter(gl.VERSION);
      checks['glVendor'] = gl.getParameter(gl.VENDOR);
      checks['glMaxViewportW'] = gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0];
      checks['glMaxViewportH'] = gl.getParameter(gl.MAX_VIEWPORT_DIMS)[1];
      checks['glMaxTexSize'] = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      checks['glContextAttributes'] = gl.getContextAttributes();
      checks['glDrawingBufferWidth'] = gl.drawingBufferWidth;
      checks['glDrawingBufferHeight'] = gl.drawingBufferHeight;
      
      // Clear color
      checks['glClearColor'] = gl.getParameter(gl.COLOR_CLEAR_VALUE);
      checks['glClearDepth'] = gl.getParameter(gl.DEPTH_CLEAR_VALUE);
      checks['glClearStencil'] = gl.getParameter(gl.STENCIL_CLEAR_VALUE);
      
      // Check if context is lost
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) {
        ext.loseContext();
        checks['glWasLost'] = gl.isContextLost();
        ext.restoreContext();
      }
    }

    // Sample pixels from canvas
    const ctx = canvas.getContext('2d');
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      let blackCount = 0, total = canvas.width * canvas.height;
      let maxR = 0, maxG = 0, maxB = 0;
      const colorSet = new Set();
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (r < 15 && g < 15 && b < 15 && a > 10) blackCount++;
        maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
        if (a > 10) colorSet.add(r + ',' + g + ',' + b);
      }
      checks['blackPct'] = (blackCount / total) * 100;
      checks['maxColor'] = { r: maxR, g: maxG, b: maxB };
      checks['uniqueColors'] = colorSet.size;
      checks['sampleColors'] = Array.from(colorSet).slice(0, 30);
    }

    return checks;
  });

  console.log('📊 Canvas/WebGL Info:');
  console.log(JSON.stringify(info, null, 2));

  // Check if there's a WebGL context on the canvas
  const hasWebGL = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return false;
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
  console.log(`\n🔧 WebGL context on canvas: ${hasWebGL}`);

  // Check if there's a separate WebGL canvas (Three.js sometimes creates its own)
  const allCanvases = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('canvas')).map(c => ({
      width: c.width,
      height: c.height,
      style: c.style?.display,
      className: c.className,
      id: c.id,
    }));
  });
  console.log(`\n📋 All canvases (${allCanvases.length}):`);
  allCanvases.forEach((c, i) => console.log(`  [${i}] ${c.width}x${c.height} display=${c.style} class="${c.className}" id="${c.id}"`));

  // Check for any WebGL-related errors
  const webglErrors = errors.filter(e => e.toLowerCase().includes('webgl') || e.toLowerCase().includes('context'));
  if (webglErrors.length > 0) {
    console.log('\n❌ WebGL errors:');
    webglErrors.forEach(e => console.log(`  ${e}`));
  }

  // Check for module errors
  const moduleErrors = errors.filter(e => e.toLowerCase().includes('module') || e.toLowerCase().includes('import'));
  if (moduleErrors.length > 0) {
    console.log('\n❌ Module errors:');
    moduleErrors.forEach(e => console.log(`  ${e}`));
  }

  // Check for Three.js related logs
  const threeLogs = logs.filter(l => l.text.includes('THREE') || l.text.includes('three') || l.text.includes('WebGL') || l.text.includes('RENDERER'));
  if (threeLogs.length > 0) {
    console.log('\n📋 Three.js/WebGL logs:');
    threeLogs.forEach(l => console.log(`  [${l.type}] ${l.text}`));
  }

  // Check if renderer is actually drawing
  const rendererState = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    
    // Check if there's a WebGL context that's being used
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { reason: 'no WebGL context' };
    
    // Check the WebGL context's drawing buffer size
    return {
      drawingBufferWidth: gl.drawingBufferWidth,
      drawingBufferHeight: gl.drawingBufferHeight,
      contextLost: gl.isContextLost(),
    };
  });
  console.log('\n🔧 Renderer state:', JSON.stringify(rendererState, null, 2));

  // Take screenshot
  await page.screenshot({ path: '/home/manager/turbo-game/turbo-web/diagnostic-output/deep-diag2.png' });
  console.log('\n📷 Screenshot: diagnostic-output/deep-diag2.png');

  await browser.close();
}

runTest();
