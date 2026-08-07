import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, 'screenshots');
const gameUrl = 'https://mcrockett86.github.io/turbo-game/';

const browser = await chromium.launch({ 
  headless: true,
  slowMo: 300,
  args: ['--no-sandbox']
});

const context = await browser.newContext({ 
  viewport: { width: 1280, height: 720 },
  locale: 'en-US'
});

const page = await context.newPage();

// Collect console errors
const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    errors.push(`[CONSOLE ERROR] ${msg.text()}`);
    console.log('❌', msg.text());
  } else if (msg.type() === 'warning') {
    console.log('⚠️', msg.text());
  }
});

page.on('pageerror', err => {
  errors.push(`[PAGE ERROR] ${err.message}`);
  console.log('🚨', err.message);
});

let screenshotNum = 0;
async function screenshot(label) {
  screenshotNum++;
  const filename = `${outputDir}/step${screenshotNum}_${label.replace(/\s+/g, '_')}.png`;
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`📸 Saved: ${filename}`);
  return filename;
}

try {
  // Step 1: Load the game
  console.log('\n🎮 Step 1: Loading game...');
  await page.goto(gameUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await screenshot('loading');
  
  // Check if canvas is visible
  const canvasVisible = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return {
      exists: !!canvas,
      display: canvas ? window.getComputedStyle(canvas).display : 'no-canvas',
      width: canvas ? canvas.width : 0,
      height: canvas ? canvas.height : 0,
      containerDisplay: document.querySelector('.screen') ? window.getComputedStyle(document.querySelector('.screen')).display : 'no-screen'
    };
  });
  console.log('Canvas state:', JSON.stringify(canvasVisible, null, 2));
  
  // Step 2: Check what's on screen
  console.log('\n🎮 Step 2: Checking page state...');
  const pageState = await page.evaluate(() => {
    const body = document.body;
    return {
      bodyBg: body.style.backgroundColor,
      bodyBackground: body.style.background,
      bodyBackgroundImage: body.style.backgroundImage,
      bodyBackgroundSize: body.style.backgroundSize,
      bodyBackgroundAttachment: body.style.backgroundAttachment,
      bodyBackgroundPosition: body.style.backgroundPosition,
      hasCanvas: !!document.querySelector('canvas'),
      canvasStyle: document.querySelector('canvas') ? window.getComputedStyle(document.querySelector('canvas')).display : 'no-canvas',
      hasStartButton: !!document.getElementById('start-button'),
      hasDogSelector: !!document.querySelector('.dog-selector'),
      hasZoneSelector: !!document.querySelector('.zone-selector'),
      bodyClasses: document.body.className,
      activeScreen: document.querySelector('.screen.active') ? document.querySelector('.screen.active').id : 'none',
      allScreens: Array.from(document.querySelectorAll('.screen')).map(s => ({ id: s.id, active: s.classList.contains('active'), display: window.getComputedStyle(s).display }))
    };
  });
  console.log('Page state:', JSON.stringify(pageState, null, 2));
  await screenshot('page_state');
  
  // Step 3: Check for dog selection UI
  console.log('\n🎮 Step 3: Checking dog selection...');
  const dogSelector = await page.evaluate(() => {
    const dogs = document.querySelectorAll('.dog-card, [data-dog], .dog-option');
    return Array.from(dogs).map(d => ({
      text: d.textContent?.trim().substring(0, 100),
      class: d.className,
      id: d.id,
      visible: d.offsetParent !== null,
      style: d.style
    }));
  });
  console.log('Dog selectors:', JSON.stringify(dogSelector, null, 2));
  
  // Step 4: Try clicking on dog cards or start button
  console.log('\n🎮 Step 4: Looking for clickable elements...');
  const clickable = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, [role="button"], .btn, .clickable');
    return Array.from(buttons).map(b => ({
      text: b.textContent?.trim().substring(0, 50),
      class: b.className,
      id: b.id,
      type: b.tagName,
      visible: b.offsetParent !== null
    }));
  });
  console.log('Clickable elements:', JSON.stringify(clickable, null, 2));
  await screenshot('clickable_elements');
  
  // Step 5: Check what's rendered on canvas
  console.log('\n🎮 Step 5: Checking canvas content...');
  const canvasContent = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 'no-canvas';
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-context';
    // Get pixel data from center
    const data = ctx.getImageData(canvas.width/2, canvas.height/2, 1, 1).data;
    return {
      width: canvas.width,
      height: canvas.height,
      centerPixel: `rgb(${data[0]},${data[1]},${data[2]})`,
      display: window.getComputedStyle(canvas).display,
      zIndex: window.getComputedStyle(canvas).zIndex
    };
  });
  console.log('Canvas content:', JSON.stringify(canvasContent, null, 2));
  
  // Step 6: Check CSS for the game screens
  console.log('\n🎮 Step 6: Checking CSS styles...');
  const cssInfo = await page.evaluate(() => {
    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    return Array.from(styles).map(s => {
      if (s.textContent) {
        return { type: 'inline', content: s.textContent.substring(0, 200) };
      }
      return { type: 'external', href: s.href };
    });
  });
  console.log('CSS sources:', JSON.stringify(cssInfo, null, 2));
  
  // Also check computed styles for key elements
  const keyStyles = await page.evaluate(() => {
    const selectors = ['body', '.screen', '#fp-view', '#tp-view', '#human-view', 'canvas'];
    return Object.fromEntries(selectors.map(sel => {
      const el = document.querySelector(sel);
      return [sel, el ? {
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
        opacity: window.getComputedStyle(el).opacity,
        background: window.getComputedStyle(el).background,
        backgroundImage: window.getComputedStyle(el).backgroundImage,
        color: window.getComputedStyle(el).color,
        class: el.className
      } : null];
    }));
  });
  console.log('Key element styles:', JSON.stringify(keyStyles, null, 2));
  
  console.log('\n📋 All console errors collected:');
  errors.forEach(e => console.log('  ' + e));
  
} catch (err) {
  console.error('Error during test:', err.message);
  await screenshot('error_' + err.message.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_'));
} finally {
  await browser.close();
  console.log('\n✅ Test complete. Check screenshots in', outputDir);
}
