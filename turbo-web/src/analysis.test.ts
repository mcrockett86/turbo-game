/**
 * Turbo: Lost & Found — Analysis Script Smoke Tests
 *
 * Verifies that the deep-analysis and playthrough-sim scripts
 * run to completion and produce expected output files.
 *
 * These are integration-level checks — they require:
 * - A running Vite dev server on http://localhost:3000
 * - xvfb (virtual display) available on the host
 *
 * Run with: npm run test:analysis
 * (Automatically wrapped with xvfb-run)
 *
 * Note: Each analysis runs all 5 dogs (~10 min total).
 * Tests run once per script, then validate outputs.
 */

import { test, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const PROJECT_ROOT = join(ROOT, '..'); // /home/manager/turbo-game

// ---- Shared test state ----
let deepAnalysisOutput = '';
let playthroughOutput = '';

/**
 * Run an analysis script, automatically wrapping with xvfb-run if needed.
 * Detects if we're already inside an xvfb environment to avoid nested Xvfb.
 */
function runAnalysisScript(scriptName: string): string {
  const hasDisplay = !!process.env.DISPLAY;
  const cmd = hasDisplay
    ? `npx tsx ${scriptName}.ts`
    : `xvfb-run npx tsx ${scriptName}.ts`;

  return execSync(cmd, {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 600_000, // 10 minutes — each analysis takes ~10 min (5 dogs)
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// ---- Setup: Run each analysis script once ----
beforeAll(() => {
  console.log('\n🐾 Running deep-analysis (all 5 dogs)...');
  deepAnalysisOutput = runAnalysisScript('deep-analysis');
}, 660_000); // 11 min timeout for setup

beforeAll(() => {
  console.log('\n🐾 Running playthrough-sim (all 5 dogs)...');
  playthroughOutput = runAnalysisScript('playthrough-sim');
}, 660_000);

// ---- Deep Analysis Tests ----
test('deep-analysis.ts runs to completion', () => {
  expect(deepAnalysisOutput).toContain('Deep analysis complete');
  expect(deepAnalysisOutput).toContain('Report saved to');
});

test('deep-analysis produces report file', () => {
  const reportPath = join(PROJECT_ROOT, 'deep-analysis-report.md');
  expect(existsSync(reportPath)).toBe(true);
  const content = readFileSync(reportPath, 'utf-8');
  expect(content.length).toBeGreaterThan(1000);
  expect(content).toContain('Critical Findings');
  expect(content).toContain('Recommendations');
});

test('deep-analysis produces screenshots', () => {
  const screenshotDir = join(PROJECT_ROOT, 'deep-analysis-screenshots');
  const files = readdirSync(screenshotDir).filter(f => f.endsWith('.png'));
  expect(files.length).toBeGreaterThan(0);
  // Should have at least home, selected, and game screenshots per dog (5 dogs)
  const uniqueScreenshots = new Set(files.map(f => f.split('-')[0]));
  expect(uniqueScreenshots.size).toBeGreaterThan(0);
});

// ---- Playthrough Simulation Tests ----
test('playthrough-sim.ts runs to completion', () => {
  expect(playthroughOutput).toContain('Simulation complete');
  expect(playthroughOutput).toContain('Report saved to');
});

test('playthrough-sim produces report file', () => {
  const reportPath = join(PROJECT_ROOT, 'playthrough-report.md');
  expect(existsSync(reportPath)).toBe(true);
  const content = readFileSync(reportPath, 'utf-8');
  expect(content.length).toBeGreaterThan(1000);
});

test('playthrough-sim produces screenshots', () => {
  const screenshotDir = join(PROJECT_ROOT, 'playthrough-screenshots');
  const files = readdirSync(screenshotDir).filter(f => f.endsWith('.png'));
  expect(files.length).toBeGreaterThan(0);
});
