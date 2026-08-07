import { chromium } from 'playwright';

const outputDir = '/home/manager/turbo-game/screenshots';
const gameUrl = 'https://mcrockett86.github.io/turbo-game/';

const browser = await chromium.launch({ 
  headless: true,
  slowMo: 500,
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
  } else if (msg.type() === 'warning') {
    console.log('⚠️', msg.text());
  }
});
page.on('pageerror', err => {
  errors.push(`[PAGE] ${err.message}`);
  console.log('🚨', err.message);
});

let step = 0;
async function snap(label) {
  step++;
  const filename = `${outputDir}/play_${String(step).padStart(2,'0')}_${label.replace(/\s+/g,'_')}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`📸 ${filename}`);
  
  // Also dump key state
  const state = await page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas, canvas');
    return {
      activeScreen: document.querySelector('.screen.active')?.id || 'none',
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      canvasDisplay: canvas ? window.getComputedStyle(canvas).display : 'no-canvas',
      bodyBg: document.body.style.background || document.body.style.backgroundColor || 'none',
      hudVisible: !!document.getElementById('hud'),
      hudDisplay: document.getElementById('hud') ? window.getComputedStyle(document.getElementById('hud')).display : 'no-hud',
      dialogueBox: document.querySelector('.dialogue-box')?.textContent?.substring(0, 80) || 'none',
      zoneName: document.querySelector('.zone-name')?.textContent || 'none',
      roomId: document.querySelector('.room-name')?.textContent || 'none',
      allScreens: Array.from(document.querySelectorAll('.screen')).map(s => ({
        id: s.id, active: s.classList.contains('active'), display: window.getComputedStyle(s).display
      }))
    };
  });
  console.log('📊 State:', JSON.stringify(state, null, 2));
}

try {
  // 1. Load game
  console.log('\n═══ Loading game ═══');
  await page.goto(gameUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await snap('01_loaded');
  
  // 2. Select a dog (click first dog card)
  console.log('\n═══ Selecting dog ═══');
  const dogCards = await page.$$('.dog-card');
  console.log(`Found ${dogCards.length} dog cards`);
  if (dogCards.length > 0) {
    await dogCards[0].click();
    await page.waitForTimeout(800);
    await snap('02_dog_selected');
    
    // Check which dog was selected
    const selected = await page.evaluate(() => {
      const active = document.querySelector('.dog-card.selected');
      return active?.dataset?.dogId || 'none';
    });
    console.log(`Selected dog: ${selected}`);
  }
  
  // 3. Click start button
  console.log('\n═══ Starting game ═══');
  const startBtn = await page.$('#start-adventure-btn');
  if (startBtn) {
    const visible = await startBtn.isVisible();
    console.log(`Start button visible: ${visible}`);
    if (visible) {
      await startBtn.click();
      console.log('Clicked start!');
    } else {
      // Try clicking anyway
      await page.evaluate(() => {
        const btn = document.getElementById('start-adventure-btn');
        if (btn) btn.click();
      });
      console.log('Clicked invisible start button');
    }
    await page.waitForTimeout(1000);
    await snap('03_start_clicked');
  } else {
    console.log('No start button found');
    await snap('03_no_start_btn');
  }
  
  // 4. Wait for transition
  console.log('\n═══ Waiting for transition ═══');
  await page.waitForTimeout(3000);
  await snap('04_after_transition');
  
  // 5. Check what zone we're in
  const currentZone = await page.evaluate(() => {
    const zoneName = document.querySelector('.zone-name')?.textContent;
    const roomId = document.querySelector('.room-name')?.textContent;
    const active = document.querySelector('.screen.active')?.id;
    return { zoneName, roomId, active };
  });
  console.log('Current zone state:', JSON.stringify(currentZone, null, 2));
  
  // 6. Look for any errors or issues
  console.log('\n═══ Checking for issues ═══');
  if (errors.length > 0) {
    console.log(`Found ${errors.length} errors:`);
    errors.forEach(e => console.log('  ' + e));
  } else {
    console.log('No errors found');
  }
  
  // 7. Final state dump
  console.log('\n═══ Final state ═══');
  const finalState = await page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas, canvas');
    return {
      activeScreen: document.querySelector('.screen.active')?.id || 'none',
      canvas: canvas ? {
        width: canvas.width,
        height: canvas.height,
        display: window.getComputedStyle(canvas).display,
        zIndex: window.getComputedStyle(canvas).zIndex
      } : null,
      fpView: document.getElementById('fp-view') ? {
        active: document.getElementById('fp-view').classList.contains('active'),
        display: window.getComputedStyle(document.getElementById('fp-view')).display
      } : null,
      bodyBackground: document.body.style.background || 'none',
      bodyBackgroundImage: document.body.style.backgroundImage || 'none',
      bodyColor: document.body.style.color || 'none',
      allElements: document.querySelectorAll('*').length,
      bodyBgColor: getComputedStyle(document.body).backgroundColor,
      bodyBgImage: getComputedStyle(document.body).backgroundImage
    };
  });
  console.log('Final state:', JSON.stringify(finalState, null, 2));
  await snap('05_final_state');
  
} catch (err) {
  console.error('Test error:', err.message);
  step++;
  await page.screenshot({ path: `${outputDir}/play_${String(step).padStart(2,'0')}_error.png`, fullPage: true });
} finally {
  await browser.close();
  console.log('\n✅ Done. Errors:', errors.length);
}
