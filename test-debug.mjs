import { chromium } from 'playwright';

const outputDir = '/home/manager/turbo-game/screenshots';
const gameUrl = 'https://mcrockett86.github.io/turbo-game/';

const browser = await chromium.launch({ 
  headless: true,
  slowMo: 200,
  args: ['--no-sandbox']
});

const context = await browser.newContext({ 
  viewport: { width: 1280, height: 720 },
  locale: 'en-US'
});

const page = await context.newPage();

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    errors.push(`[ERROR] ${msg.text()}`);
    console.log('❌', msg.text());
  }
});
page.on('pageerror', err => {
  errors.push(`[PAGE] ${err.message}`);
  console.log('🚨', err.message);
});

let step = 0;
async function snap(label) {
  step++;
  const filename = `${outputDir}/debug_${String(step).padStart(2,'0')}_${label.replace(/\s+/g,'_')}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`📸 ${filename}`);
}

try {
  // 1. Load game
  console.log('\n═══ Loading game ═══');
  await page.goto(gameUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await snap('01_loaded');
  
  // 2. Select dog and click start
  const dogCards = await page.$$('.dog-card');
  console.log(`Found ${dogCards.length} dog cards`);
  if (dogCards.length > 0) {
    await dogCards[0].click();
    await page.waitForTimeout(500);
    await snap('02_dog_selected');
  }
  
  const startBtn = await page.$('#start-adventure-btn');
  if (startBtn) {
    await startBtn.click();
    console.log('Clicked start!');
    await snap('03_start_clicked');
  }
  
  // 3. Wait for transition
  await page.waitForTimeout(3000);
  await snap('04_after_transition');
  
  // 4. Detailed canvas check
  console.log('\n═══ Canvas analysis ═══');
  const canvasInfo = await page.evaluate(() => {
    const allCanvases = Array.from(document.querySelectorAll('canvas'));
    return allCanvases.map((c, i) => ({
      index: i,
      id: c.id,
      className: c.className,
      width: c.width,
      height: c.height,
      styleWidth: c.style.width,
      styleHeight: c.style.height,
      display: window.getComputedStyle(c).display,
      zIndex: window.getComputedStyle(c).zIndex,
      parentTag: c.parentElement?.tagName,
      parentId: c.parentElement?.id,
      parentClass: c.parentElement?.className,
      canvasParentDisplay: c.parentElement ? window.getComputedStyle(c.parentElement).display : 'no-parent',
    }));
  });
  console.log('All canvases:', JSON.stringify(canvasInfo, null, 2));
  
  // 5. Check game rendering state
  console.log('\n═══ Game state ═══');
  const gameState = await page.evaluate(() => {
    // Check if fp-view has a canvas
    const fpView = document.getElementById('fp-view');
    const fpCanvas = fpView?.querySelector('canvas');
    return {
      fpViewId: fpView?.id,
      fpViewActive: fpView?.classList.contains('active'),
      fpViewDisplay: fpView ? window.getComputedStyle(fpView).display : 'no-fp',
      fpViewBg: fpView ? window.getComputedStyle(fpView).backgroundColor : 'no-fp',
      fpCanvasExists: !!fpCanvas,
      fpCanvasWidth: fpCanvas?.width || 0,
      fpCanvasHeight: fpCanvas?.height || 0,
      fpCanvasStyleWidth: fpCanvas?.style?.width || 'none',
      fpCanvasDisplay: fpCanvas ? window.getComputedStyle(fpCanvas).display : 'no-canvas',
      fpCanvasZIndex: fpCanvas ? window.getComputedStyle(fpCanvas).zIndex : 'no-canvas',
      fpCanvasBg: fpCanvas ? window.getComputedStyle(fpCanvas).backgroundColor : 'no-canvas',
      fpCanvasParent: fpCanvas?.parentElement?.tagName,
      // Check WebGL context
      glContext: fpCanvas ? (fpCanvas.getContext('webgl') ? 'has-gl' : 'no-gl') : 'no-canvas',
      // Check if THREE.js renderer exists
      hasRenderer: typeof THREE !== 'undefined' && THREE?.WebGLRenderer ? 'has-three' : 'no-three',
      // Check State object
      hasState: typeof State !== 'undefined' ? 'has-state' : 'no-state',
      stateGamePhase: typeof State !== 'undefined' ? State.state?.gamePhase : 'no-state',
      stateCurrentZone: typeof State !== 'undefined' ? State.state?.currentZone : 'no-state',
      stateCurrentRoom: typeof State !== 'undefined' ? State.state?.currentRoom : 'no-state',
      stateCurrentDog: typeof State !== 'undefined' ? State.state?.currentDog : 'no-state',
      // Check for HUD
      hudExists: !!document.getElementById('hud'),
      hudDisplay: document.getElementById('hud') ? window.getComputedStyle(document.getElementById('hud')).display : 'no-hud',
      // Check for dialogue
      dialogueBox: document.querySelector('.dialogue-box')?.textContent?.substring(0, 100) || 'none',
      // Check for zone/room name
      zoneName: document.querySelector('.zone-name')?.textContent || 'none',
      roomName: document.querySelector('.room-name')?.textContent || 'none',
      // Check all elements with text
      allTextElements: Array.from(document.querySelectorAll('*, [class*="zone"], [class*="room"], [class*="hud"]'))
        .filter(el => el.textContent?.trim())
        .slice(0, 20)
        .map(el => ({ tag: el.tagName, text: el.textContent?.trim().substring(0, 50), class: el.className })),
    };
  });
  console.log('Game state:', JSON.stringify(gameState, null, 2));
  await snap('05_game_state');
  
  // 6. Check if there's a WebGL canvas that's been hidden
  console.log('\n═══ WebGL check ═══');
  const glInfo = await page.evaluate(() => {
    const allElements = document.querySelectorAll('*');
    const glCanvases = [];
    allElements.forEach(el => {
      if (el.tagName === 'CANVAS' || el.getContext) {
        try {
          const gl = el.getContext('webgl');
          if (gl) {
            glCanvases.push({
              tag: el.tagName,
              id: el.id,
              class: el.className,
              width: el.width || el.offsetWidth,
              height: el.height || el.offsetHeight,
              display: window.getComputedStyle(el).display,
              parentTag: el.parentElement?.tagName,
              parentId: el.parentElement?.id,
            });
          }
        } catch {}
      }
    });
    return glCanvases;
  });
  console.log('WebGL canvases:', JSON.stringify(glInfo, null, 2));
  
  // 7. Check body background
  console.log('\n═══ Body background ═══');
  const bodyBg = await page.evaluate(() => {
    const body = document.body;
    const style = window.getComputedStyle(body);
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      background: style.background,
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      backgroundAttachment: style.backgroundAttachment,
    };
  });
  console.log('Body background:', JSON.stringify(bodyBg, null, 2));
  
  // 8. Check for any rendering errors
  console.log('\n═══ Errors ═══');
  if (errors.length > 0) {
    console.log(`${errors.length} errors:`);
    errors.forEach(e => console.log('  ' + e));
  } else {
    console.log('No errors');
  }
  
} catch (err) {
  console.error('Test error:', err.message);
  step++;
  await page.screenshot({ path: `${outputDir}/debug_${String(step).padStart(2,'0')}_error.png`, fullPage: true });
} finally {
  await browser.close();
  console.log('\n✅ Done. Errors:', errors.length);
}
