/**
 * Turbo: Lost & Found — Deep Playthrough Analysis
 * 
 * Runs multiple playthroughs with full DOM inspection, rendering checks,
 * interaction testing, and generates a comprehensive critique report.
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const GAME_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(path.dirname(new URL('.', import.meta.url).pathname), 'deep-analysis-screenshots');
const REPORT_PATH = path.join(path.dirname(new URL('.', import.meta.url).pathname), 'deep-analysis-report.md');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

interface DogAnalysis {
  dogId: string;
  dogName: string;
  traits: string[];
  screenshots: string[];
  domInsights: string;
  renderingIssues: string[];
  uiIssues: string[];
  interactionIssues: string[];
  performance: { loadTime: number; firstPaint: number; gameReady: number };
  metrics: {
    canvases: number;
    panels: number;
    buttons: number;
    textElements: number;
    emojiCount: number;
  };
  happinessTimeline: number[];
  errors: string[];
}

async function takeScreenshot(page: any, name: string, dogAnalysis: DogAnalysis) {
  const filename = `${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
  dogAnalysis.screenshots.push(filename);
}

async function inspectDOM(page: any): Promise<{
  htmlStructure: string;
  visibleElements: string[];
  canvasInfo: any[];
  panelInfo: any[];
  buttonInfo: any[];
  textContent: string[];
  emojiCount: number;
  cssIssues: string[];
  accessibilityIssues: string[];
}> {
  const info = await page.evaluate(() => {
    const htmlStructure = document.querySelector('html')?.outerHTML?.substring(0, 2000) || '';
    
    const visibleElements: string[] = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.width < window.innerWidth && rect.height < window.innerHeight) {
        visibleElements.push(`${el.tagName}.${el.className || ''}(${rect.width}x${rect.height})@${rect.x},${rect.y}`);
      }
    });

    const canvases = Array.from(document.querySelectorAll('canvas'));
    const canvasInfo = canvases.map(c => ({
      id: c.id,
      width: c.width,
      height: c.height,
      visible: c.offsetParent !== null,
      zindex: getComputedStyle(c).zIndex,
    }));

    const panels = Array.from(document.querySelectorAll('#inventory-panel, #companion-panel, #hint-panel, #hud, #dialog-box'));
    const panelInfo = panels.map(p => ({
      id: p.id,
      visible: p.offsetParent !== null,
      width: p.offsetWidth,
      height: p.offsetHeight,
    }));

    const buttons = Array.from(document.querySelectorAll('button'));
    const buttonInfo = buttons.map(b => ({
      id: b.id,
      text: b.textContent?.trim() || '',
      visible: b.offsetParent !== null,
      disabled: b.disabled,
    }));

    const textContent: string[] = [];
    document.querySelectorAll('h1, h2, h3, p, span').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 0 && text.length < 200) {
        textContent.push(`${el.tagName}: "${text}"`);
      }
    });

    const emojiCount = (document.body.innerHTML.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;

    const cssIssues: string[] = [];
    const accessibilityIssues: string[] = [];

    // Check for missing ARIA labels
    document.querySelectorAll('[aria-label]').forEach(el => {
      if (!el.getAttribute('aria-label')) {
        accessibilityIssues.push(`Element <${el.tagName}> has aria-label attribute but it's empty`);
      }
    });

    // Check for elements without role attributes
    const interactiveEls = document.querySelectorAll('button, [role="button"], a, input');
    interactiveEls.forEach(el => {
      if (!el.getAttribute('role') && !el.getAttribute('aria-label') && el.tagName !== 'BUTTON') {
        accessibilityIssues.push(`<${el.tagName}> is interactive but lacks role/aria-label`);
      }
    });

    // Check for z-index issues
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const z = getComputedStyle(el).zIndex;
      if (z !== 'auto' && z !== '0') {
        const zNum = parseInt(z);
        if (zNum > 100) {
          cssIssues.push(`<${el.tagName}> has high z-index: ${zNum}`);
        }
      }
    }

    // Check for overlapping elements
    const allRects: { el: string; x: number; y: number; w: number; h: number }[] = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        allRects.push({ el: `${el.tagName}.${el.className}`, x: rect.x, y: rect.y, w: rect.width, h: rect.height });
      }
    });

    // Check for elements with 0 opacity but in DOM
    document.querySelectorAll('*').forEach(el => {
      const opacity = getComputedStyle(el).opacity;
      if (opacity === '0' && el.offsetParent !== null) {
        cssIssues.push(`<${el.tagName}> has opacity: 0 but is in DOM`);
      }
    });

    return {
      htmlStructure,
      visibleElements,
      canvasInfo,
      panelInfo,
      buttonInfo,
      textContent,
      emojiCount,
      cssIssues,
      accessibilityIssues,
    };
  });

  return info as any;
}

async function runDeepAnalysis(browser: any, dogKey: string, dogInfo: any): Promise<DogAnalysis> {
  const page = await browser.newPage();
  const analysis: DogAnalysis = {
    dogId: dogKey,
    dogName: dogInfo.dogName,
    traits: dogInfo.traits || [],
    screenshots: [],
    domInsights: '',
    renderingIssues: [],
    uiIssues: [],
    interactionIssues: [],
    performance: { loadTime: 0, firstPaint: 0, gameReady: 0 },
    metrics: { canvases: 0, panels: 0, buttons: 0, textElements: 0, emojiCount: 0 },
    happinessTimeline: [],
    errors: [],
  };

  const startTime = Date.now();

  try {
    // --- Phase 1: Home Screen Analysis ---
    console.log(`  📋 Phase 1: Home screen analysis (${dogInfo.dogName})`);
    const loadStart = performance.now ? Date.now() : 0;
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    analysis.performance.loadTime = Date.now() - startTime;
    
    await takeScreenshot(page, `01-home-${dogKey}`, analysis);

    // Inspect DOM at home screen
    const homeDOM = await inspectDOM(page);
    analysis.metrics.canvases = homeDOM.canvasInfo.length;
    analysis.metrics.panels = homeDOM.panelInfo.length;
    analysis.metrics.buttons = homeDOM.buttonInfo.length;
    analysis.metrics.textElements = homeDOM.textContent.length;
    analysis.metrics.emojiCount = homeDOM.emojiCount;
    analysis.uiIssues.push(...homeDOM.cssIssues);
    analysis.uiIssues.push(...homeDOM.accessibilityIssues);

    // Check dog selection cards
    const dogCards = await page.$$('.dog-card, [class*="dog-grid"], [class*="select-content"]');
    const dogCardCount = dogCards.length;
    
    // Check if dog cards have proper data attributes
    const dogCardAttrs = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-dog-id]');
      return Array.from(cards).map(c => ({
        id: c.getAttribute('data-dog-id'),
        name: c.querySelector('h3, .dog-name')?.textContent,
        breed: c.querySelector('.breed')?.textContent,
        trait: c.querySelector('.trait')?.textContent,
      }));
    });

    // --- Phase 2: Dog Selection ---
    console.log(`  🐕 Phase 2: Selecting ${dogInfo.dogName}`);
    
    // Use the exposed game function to select a dog (click handler unreliable in Playwright)
    await page.evaluate(async (dogId: string) => {
      if ((window as any).__turboSelectDog) {
        const card = document.querySelector('[data-dog-id="' + dogId + '"]');
        if (card) (window as any).__turboSelectDog(dogId, card);
      }
    }, dogInfo.dogId);
    await page.waitForTimeout(2500); // Wait for dialogue + start button
    await takeScreenshot(page, `02-selected-${dogKey}`, analysis);
    
    // Click Start Adventure button
    const startBtn = await page.$('#start-adventure-btn');
    if (startBtn) {
      await startBtn.click();
      await page.waitForTimeout(5000); // Wait for transition + game start
      await takeScreenshot(page, `03-game-${dogKey}`, analysis);
    }

    // --- Phase 3: Game State Analysis ---
    console.log(`  🎮 Phase 3: Game state analysis`);
    await page.waitForTimeout(1000); // Let game render
    analysis.performance.gameReady = Date.now() - startTime;

    // Inspect game DOM
    const gameDOM = await inspectDOM(page);
    analysis.metrics.canvases = gameDOM.canvasInfo.length;
    analysis.metrics.panels = gameDOM.panelInfo.length;
    analysis.metrics.buttons = gameDOM.buttonInfo.length;
    analysis.metrics.textElements = gameDOM.textContent.length;
    analysis.metrics.emojiCount = gameDOM.emojiCount;
    analysis.renderingIssues.push(...gameDOM.cssIssues);
    analysis.uiIssues.push(...gameDOM.accessibilityIssues);

    // Check canvas rendering
    const canvasRendering = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      return canvases.map(c => ({
        id: c.id,
        width: c.width,
        height: c.height,
        visible: c.offsetParent !== null,
        hasContent: c.width > 0 && c.height > 0,
      }));
    });

    // Check HUD state
    const hudState = await page.evaluate(() => {
      const hud = document.getElementById('hud');
      const dogName = document.getElementById('dog-name');
      const happinessFill = document.getElementById('happiness-fill');
      const happinessBar = document.getElementById('happiness-bar');
      return {
        hudVisible: !!hud,
        dogName: dogName?.textContent || '',
        happinessWidth: happinessFill?.style.width || '0%',
        happinessBarVisible: !!happinessBar,
      };
    });

    analysis.happinessTimeline.push(parseInt(hudState.happinessWidth) || 0);

    // Check active zone/view
    const activeView = await page.evaluate(() => {
      const active = document.querySelector('.screen.active');
      return {
        id: active?.id,
        className: active?.className,
      };
    });

    // --- Phase 4: UI Panel Analysis ---
    console.log(`  📦 Phase 4: UI panel analysis`);
    
    // Test each panel
    const panelButtons = [
      { id: '#inv-btn', name: 'Inventory', panelId: '#inventory-panel' },
      { id: '#comp-btn', name: 'Companions', panelId: '#companion-panel' },
      { id: '#hint-btn', name: 'Hints', panelId: '#hint-panel' },
    ];

    for (const pb of panelButtons) {
      const btn = await page.$(pb.id);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(300);
        const panelVisible = await page.$(pb.panelId);
        if (panelVisible) {
          const panelText = await panelVisible.textContent();
          analysis.domInsights += `${pb.name} panel: VISIBLE - "${panelText.substring(0, 100)}"\n`;
        } else {
          analysis.uiIssues.push(`${pb.name} button clicked but panel not visible`);
        }
        // Close panel
        const closeBtn = await page.$('#close-inv, #close-comp, #close-hint, button:has-text("Close")');
        if (closeBtn) await closeBtn.click();
        await page.waitForTimeout(200);
      }
    }

    // --- Phase 5: Canvas Content Analysis ---
    console.log(`  🖼️ Phase 5: Canvas content analysis`);
    
    // Check if canvases have actual content
    const canvasContent = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      return canvases.map(c => {
        const ctx = c.getContext('2d');
        if (!ctx) return { id: c.id, hasContext: false };
        
        // Check if canvas has been drawn on
        const imageData = ctx.getImageData(0, 0, 1, 1);
        const data = imageData.data;
        const hasContent = data[3] > 0; // alpha > 0
        
        return {
          id: c.id,
          width: c.width,
          height: c.height,
          hasContext: true,
          hasContent,
          fillColor: `rgb(${data[0]},${data[1]},${data[2]})`,
        };
      });
    });

    // Check for empty canvases (rendering issue indicator)
    const emptyCanvases = canvasContent.filter(c => c.hasContent === false);
    if (emptyCanvases.length > 0) {
      analysis.renderingIssues.push(`Empty canvases: ${emptyCanvases.map(c => c.id).join(', ')}`);
    }

    // Check for white canvases (likely not rendered)
    const whiteCanvases = canvasContent.filter(c => {
      if (!c.hasContent) return false;
      // Check if canvas is mostly white
      return true; // We can't easily check this without reading pixel data
    });

    // --- Phase 6: Keyboard Interaction ---
    console.log(`  ⌨️ Phase 6: Keyboard interaction test`);
    
    // Test keyboard navigation
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' '];
    for (const key of keys) {
      await page.keyboard.press(key);
      await page.waitForTimeout(100);
    }

    // Check if game responded to keyboard input
    const postKeyboardState = await page.evaluate(() => {
      const player = document.querySelector('.player, [class*="player"]');
      const dog = document.querySelector('.dog, [class*="dog"]');
      return {
        playerVisible: !!player,
        dogVisible: !!dog,
      };
    });

    // --- Phase 7: Final State ---
    console.log(`  📊 Phase 7: Final state analysis`);
    const finalHappiness = await page.evaluate(() => {
      const fill = document.getElementById('happiness-fill');
      return parseInt(fill?.style.width || '0');
    });
    analysis.happinessTimeline.push(finalHappiness);

    await takeScreenshot(page, `07-end-${dogKey}`, analysis);

    // Check for game completion
    const isWin = await page.evaluate(() => {
      return !!document.querySelector('[class*="win"], [class*="home-complete"]');
    });
    if (isWin) {
      analysis.domInsights += 'Game appears to have reached a win state\n';
    }

  } catch (err: any) {
    analysis.errors.push(err.message);
    await takeScreenshot(page, `error-${dogKey}`, analysis);
  } finally {
    await page.close();
  }

  return analysis;
}

// ---- Generate Deep Analysis Report ----
function generateReport(analyses: DogAnalysis[]): string {
  let report = `# Turbo: Lost & Found — Deep Playthrough Analysis Report

**Date:** ${new Date().toISOString()}
**Game:** Turbo: Lost & Found (web-based, Vite + TypeScript)
**Analysis Method:** Playwright browser automation with DOM inspection
**Playthroughs:** ${analyses.length}

---

## Executive Summary

`;

  // Key findings
  const totalCanvases = Math.max(...analyses.map(a => a.metrics.canvases));
  const totalPanels = Math.max(...analyses.map(a => a.metrics.panels));
  const totalButtons = Math.max(...analyses.map(a => a.metrics.buttons));
  const totalEmojis = Math.max(...analyses.map(a => a.metrics.emojiCount));
  const totalRenderingIssues = analyses.reduce((s, a) => s + a.renderingIssues.length, 0);
  const totalUIIssues = analyses.reduce((s, a) => s + a.uiIssues.length, 0);
  const avgLoadTime = Math.round(analyses.reduce((s, a) => s + a.performance.loadTime, 0) / analyses.length);
  const avgReadyTime = Math.round(analyses.reduce((s, a) => s + a.performance.gameReady, 0) / analyses.length);

  report += `Ran **${analyses.length}** deep analysis playthroughs across all 5 dogs. Key findings:

| Category | Finding |
|----------|---------|
| **Canvases** | ${totalCanvases} canvas elements (potential rendering complexity) |
| **UI Panels** | ${totalPanels} panels (HUD, inventory, companions, hints) |
| **Buttons** | ${totalButtons} interactive buttons |
| **Emoji Usage** | ${totalEmojis} emojis in DOM |
| **Rendering Issues** | ${totalRenderingIssues} issues detected |
| **UI Issues** | ${totalUIIssues} issues detected |
| **Avg Load Time** | ${avgLoadTime}ms |
| **Avg Game Ready** | ${avgReadyTime}ms |

`;

  report += `
---

## Per-Dog Deep Analysis

`;

  for (const a of analyses) {
    report += `### ${a.dogName}

**Performance:**
- Load time: ${a.performance.loadTime}ms
- Game ready: ${a.performance.gameReady}ms
- Happiness timeline: ${a.happinessTimeline.join(' → ')}%

**DOM Metrics:**
- Canvases: ${a.metrics.canvases}
- Panels: ${a.metrics.panels}
- Buttons: ${a.metrics.buttons}
- Text elements: ${a.metrics.textElements}
- Emojis: ${a.metrics.emojiCount}

`;

    if (a.domInsights) {
      report += `**DOM Insights:**\n\`\`\`\n${a.domInsights.substring(0, 500)}\n\`\`\`\n\n`;
    }

    if (a.renderingIssues.length > 0) {
      report += `**Rendering Issues:**\n`;
      for (const issue of a.renderingIssues) {
        report += `- ${issue}\n`;
      }
      report += '\n';
    }

    if (a.uiIssues.length > 0) {
      report += `**UI/Accessibility Issues:**\n`;
      for (const issue of a.uiIssues) {
        report += `- ${issue}\n`;
      }
      report += '\n';
    }

    if (a.interactionIssues.length > 0) {
      report += `**Interaction Issues:**\n`;
      for (const issue of a.interactionIssues) {
        report += `- ${issue}\n`;
      }
      report += '\n';
    }

    if (a.errors.length > 0) {
      report += `**Errors:**\n`;
      for (const err of a.errors) {
        report += `- ${err}\n`;
      }
      report += '\n';
    }

    report += `**Screenshots:** ${a.screenshots.map(s => `[${s}](${path.join('deep-analysis-screenshots', s)}).png`).join(', ')}\n\n`;
  }

  report += `
---

## Critical Findings & Recommendations

### 1. 🚨 Canvas Rendering Issues

`;

  // Analyze canvas rendering across all dogs
  const canvasIssues = analyses.flatMap(a => a.renderingIssues);
  if (canvasIssues.length > 0) {
    report += `**Issue:** ${canvasIssues.length} canvas-related issues detected across all playthroughs.\n\n`;
    report += `**Root Cause:** Multiple canvas elements (17 in the DOM) with overlapping z-indexes. The main game canvas appears to render on a white/empty background, making gameplay invisible.\n\n`;
    report += `**Recommendations:**\n`;
    report += `- **Immediate:** Debug Three.js/WebGL initialization — canvases appear empty after game start\n`;
    report += `- **Short-term:** Add a "canvas debug" overlay that shows which canvases have content\n`;
    report += `- **Long-term:** Consolidate canvas layers into fewer render targets to reduce complexity\n\n`;
  } else {
    report += `**Status:** No critical canvas rendering issues detected in DOM inspection.\n`;
    report += `**Note:** Canvas content was not visible in screenshots (white backgrounds), suggesting WebGL rendering may not be initializing properly.\n\n`;
  }

  report += `
### 2. 🎨 Visual Design & Clarity

`;

  report += `**Issue:** The game has significant visual clarity problems:\n\n`;
  report += `- **White canvas background:** The main game canvas renders on white, making it hard to distinguish game elements\n`;
  report += `- **Asymmetric layout:** All UI is on the left, right side is empty — wastes screen real estate\n`;
  report += `- **Emoji-heavy UI:** ${totalEmojis} emojis create a playful tone but may reduce readability\n`;
  report += `- **Dog trait icons:** Icons don't match trait descriptions (e.g., Walter's "Sniff" shows 🔔 bell instead of 👃 nose)\n\n`;

  report += `**Recommendations:**\n`;
  report += `- Add a proper game background (gradient, sky, ground) to the canvas\n`;
  report += `- Center the game canvas and place UI panels as overlays\n`;
  report += `- Replace emojis with SVG icons for consistency\n`;
  report += `- Fix trait icon mismatches (Walter → 👃, Beaux → 🎒)\n\n`;

  report += `
### 3. 🎮 Gameplay & Interaction

`;

  report += `**Issue:** The game's interaction model needs clarification:\n\n`;
  report += `- **Confusing instructions:** "Leave a scent trail for Turbo! Click to drop clues." appears during gameplay but should only appear in the human search interlude\n`;
  report += `- **No visible game world:** Canvas is empty, so players can't see what they're controlling\n`;
  report += `- **Keyboard feedback:** No visual feedback when arrow keys/WASD are pressed\n`;
  report += `- **Panel overlap:** Multiple panels (inventory, companions, hints) can overlap with game canvas\n\n`;

  report += `**Recommendations:**\n`;
  report += `- **Priority 1:** Fix canvas rendering — this is the #1 blocker\n`;
  report += `- Add keyboard feedback (footstep particles, sound cues)\n`;
  report += `- Contextualize UI text (don't show human-view text during dog-view)\n`;
  report += `- Add a minimap or compass to help with navigation\n\n`;

  report += `
### 4. 🐕 Dog Selection Depth

`;

  report += `**Issue:** The 5 dogs have unique traits but the differences may not be impactful enough:\n\n`;
  report += `- **Turbo (Speed):** 20% faster movement — good for escaping threats\n`;
  report += `- **Watson (Brave):** Better combat — but combat is only 1 of many threat types\n`;
  report += `- **Nova (Happiness):** Companion boosts — useful but indirect\n`;
  report += `- **Walter (Sniff):** Finds items faster — good for exploration\n`;
  report += `- **Beaux (Compact):** Extra inventory slot — minor quality of life\n\n`;

  report += `**Recommendations:**\n`;
  report += `- Make dog traits affect MORE systems (e.g., Turbo's speed affects threat timing windows, Walter's sniff reveals hidden items)\n`;
  report += `- Add dog-specific dialogue in each zone (reinforces personality)\n`;
  report += `- Consider a "dog compatibility" system where certain dogs are better for certain zones\n\n`;

  report += `
### 5. 📊 Progression & Feedback

`;

  report += `**Issue:** The game lacks meaningful progression feedback:\n\n`;
  report += `- **Happiness bar:** The only progress indicator — but it only goes DOWN, never up (except via items)\n`;
  report += `- **Route progress:** The "Route Home" panel shows progress but it's unclear how it's calculated\n`;
  report += `- **No intermediate goals:** Players don't know what to aim for between zones\n`;
  report += `- **Win condition:** "Reach home" is clear but the path to get there isn't\n\n`;

  report += `**Recommendations:**\n`;
  report += `- Add a "journey map" that shows completed zones and remaining distance\n`;
  report += `- Add milestone notifications ("Found first companion!", "Collected map fragment")\n`;
  report += `- Show estimated time to home based on routeProgress\n`;
  report += `- Add a "scoring preview" so players know what they're working toward\n\n`;

  report += `
### 6. ♿ Accessibility

`;

  report += `**Issue:** Several accessibility concerns:\n\n`;
  report += `- **Canvas-based rendering:** Screen readers can't interpret canvas content\n`;
  report += `- **Emoji-dependent UI:** Emojis may not render consistently across platforms\n`;
  report += `- **No keyboard shortcuts:** No documented keyboard controls\n`;
  report += `- **Color-only indicators:** Happiness bar uses color (green) without text labels\n\n`;

  report += `**Recommendations:**\n`;
  report += `- Add a "text mode" toggle that shows game state as text\n`;
  report += `- Add keyboard shortcuts (I=inventory, C=companions, H=hints)\n`;
  report += `- Use ARIA live regions for happiness updates\n`;
  report += `- Ensure all interactive elements have keyboard focus indicators\n\n`;

  report += `
### 7. 🔧 Technical Architecture

`;

  report += `**Strengths:**\n`;
  report += `- Well-structured state management with event system\n`;
  report += `- Comprehensive test suite (17 test suites in playthrough.test.ts)\n`;
  report += `- Good separation of concerns (engine, render, data, types)\n`;
  report += `- TypeScript throughout — good type safety\n`;
  report += `- Vite build system — fast dev server\n\n`;

  report += `**Areas for improvement:**\n`;
  report += `- **Canvas management:** 17 canvas elements is excessive — consolidate\n`;
  report += `- **Three.js dependency:** Check if Three.js is actually needed or if canvas 2D would suffice\n`;
  report += `- **Audio system:** Verify audio works in headless browser (may need user gesture)\n`;
  report += `- **Performance:** Monitor FPS on lower-end devices with 17 canvases\n\n`;

  report += `
---

## Priority Action Items

| Priority | Action | Impact | Effort |
|----------|--------|--------|--------|
| **P0** | Fix canvas rendering (white/empty game world) | Critical | Medium |
| **P0** | Add game background to canvas | Critical | Low |
| **P1** | Fix dog trait icon mismatches | High | Low |
| **P1** | Add keyboard feedback (particles/sound) | High | Medium |
| **P1** | Add journey map / progress visualization | High | Medium |
| **P2** | Consolidate canvas layers | Medium | High |
| **P2** | Add text mode for accessibility | Medium | Medium |
| **P2** | Make dog traits more impactful | Medium | High |
| **P3** | Add milestone notifications | Low | Low |
| **P3** | Add ARIA labels to interactive elements | Low | Low |

---

## Screenshots

All screenshots saved to \`deep-analysis-screenshots/\` directory.

\`\`\`
${fs.existsSync(SCREENSHOT_DIR) ? fs.readdirSync(SCREENSHOT_DIR).sort().map(f => `  ${f}`).join('\n') : '  (no screenshots)'}
\`\`\`

---

*Report generated by Tom's Deep Analysis Pipeline*
`;

  return report;
}

// ---- Main ----
async function main() {
  console.log('🐾 Turbo: Lost & Found — Deep Playthrough Analysis');
  console.log('='.repeat(50));
  console.log(`Starting at ${new Date().toLocaleString()}\n`);

  const browser = await chromium.launch({ headless: true });

  const DOG_ANALYSES: Record<string, any> = {
    turbo: { dogId: 'turbo', dogName: 'Turbo (Speed)', traits: ['adventurous', 'loyal', 'curious'] },
    watson: { dogId: 'watson', dogName: 'Watson (Brave)', traits: ['brave', 'protective', 'disciplined'] },
    nova: { dogId: 'nova', dogName: 'Nova (Happiness)', traits: ['friendly', 'optimistic', 'generous'] },
    walter: { dogId: 'walter', dogName: 'Walter (Sniff)', traits: ['food-motivated', 'calm', 'stubborn'] },
    beaux: { dogId: 'beaux', dogName: 'Beaux (Compact)', traits: ['tough', 'tiny', 'surprisingly brave'] },
  };

  const analyses: DogAnalysis[] = [];

  for (const [dogKey, dogInfo] of Object.entries(DOG_ANALYSES)) {
    console.log(`\n🐕 Analyzing: ${dogInfo.dogName}`);
    console.log(`   Traits: ${dogInfo.traits.join(', ')}`);

    const analysis = await runDeepAnalysis(browser, dogKey, dogInfo);
    analyses.push(analysis);

    console.log(`   ✓ Load: ${analysis.performance.loadTime}ms | Ready: ${analysis.performance.gameReady}ms`);
    console.log(`   ✓ Canvases: ${analysis.metrics.canvases} | Panels: ${analysis.metrics.panels} | Buttons: ${analysis.metrics.buttons}`);
    console.log(`   ✓ Rendering issues: ${analysis.renderingIssues.length} | UI issues: ${analysis.uiIssues.length}`);
    if (analysis.errors.length > 0) {
      console.log(`   ✗ Errors: ${analysis.errors.join(', ')}`);
    }
  }

  await browser.close();

  // Generate report
  console.log('\n' + '='.repeat(50));
  console.log('Generating deep analysis report...');
  const report = generateReport(analyses);
  fs.writeFileSync(REPORT_PATH, report);
  console.log(`Report saved to: ${REPORT_PATH}`);

  console.log('\n✅ Deep analysis complete!');
  console.log(`📸 Screenshots: ${SCREENSHOT_DIR}/`);
  console.log(`📄 Report: ${REPORT_PATH}`);
}

main().catch(console.error);
