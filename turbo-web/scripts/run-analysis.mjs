/**
 * run-analysis.mjs — Pre-flight setup for analysis test automation
 *
 * Automatically:
 * 1. Verifies (and installs if missing) xvfb
 * 2. Starts the Vite dev server on port 3000 (if not already running)
 * 3. Runs vitest under xvfb-run
 *
 * Usage: node scripts/run-analysis.mjs [vitest-args...]
 */

import { execFileSync, execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---- 1. Check/install xvfb ----
function checkXvfb() {
  try {
    execSync('command -v xvfb-run', { stdio: 'pipe' });
    console.log('✅ xvfb is installed');
    return true;
  } catch {
    console.log('⚠️  xvfb not found. Attempting installation...');
    
    // Check which package manager is available
    if (shellExists('apt-get')) {
      console.log('  → Installing via apt-get (may require sudo)...');
      try {
        execFileSync('sudo', ['apt-get', 'install', '-y', 'xvfb'], {
          cwd: ROOT,
          stdio: ['inherit', 'pipe', 'inherit'],
        });
        console.log('✅ xvfb installed successfully');
        return true;
      } catch (e) {
        console.error('❌ Failed to install xvfb via apt-get.');
      }
    }
    
    if (shellExists('yum')) {
      console.log('  → Installing via yum...');
      try {
        execFileSync('sudo', ['yum', 'install', '-y', 'xorg-x11-server-Xvfb'], {
          cwd: ROOT,
          stdio: ['inherit', 'pipe', 'inherit'],
        });
        console.log('✅ xvfb installed successfully');
        return true;
      } catch (e) {
        console.error('❌ Failed to install xvfb via yum.');
      }
    }
    
    console.error('❌ Cannot determine package manager. Please install xvfb manually:');
    console.error('   Debian/Ubuntu: sudo apt-get install xvfb');
    console.error('   RHEL/CentOS:   sudo yum install xorg-x11-server-Xvfb');
    console.error('   macOS:         brew install --cask xquartz');
    process.exit(1);
  }
}

// ---- 2. Start Vite dev server if not running ----
function ensureDevServer() {
  // Check if port 3000 is already in use
  try {
    execSync('lsof -i :3000', { stdio: 'pipe' });
    console.log('✅ Vite dev server already running on port 3000');
    return null;
  } catch {
    console.log('⚠️  Vite dev server not running on port 3000. Starting...');
    
    // Start Vite in background
    const vite = spawn('npx', ['vite', '--port', '3000'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    
    // Log output
    vite.stdout?.on('data', (d) => console.log(d.toString().trim()));
    vite.stderr?.on('data', (d) => console.error(d.toString().trim()));
    
    // Wait for server to be ready (up to 30 seconds)
    for (let i = 0; i < 30; i++) {
      try {
        const result = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000', { stdio: 'pipe' });
        if (result.toString().trim() === '200') {
          console.log(`✅ Vite dev server started (PID ${vite.pid})`);
          return vite;
        }
      } catch {
        // Server not ready yet
      }
      process.chdir(ROOT);
      sleep(1000);
    }
    
    console.error('❌ Failed to start Vite dev server after 30 seconds.');
    console.error('   Check logs manually: npx vite --port 3000');
    process.exit(1);
  }
}

// ---- 3. Run vitest under xvfb ----
function runTests(viteProcess) {
  // Cleanup handler
  const cleanup = () => {
    if (viteProcess && viteProcess.pid) {
      try {
        console.log('\n⚠️  Stopping Vite dev server (PID ' + viteProcess.pid + ')...');
        process.kill(viteProcess.pid, 'SIGTERM');
      } catch {
        // Already dead
      }
    }
  };
  
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
  
  // Run vitest under xvfb-run
  const args = ['npx', 'vitest', 'run', ...process.argv.slice(2)];
  console.log('\n▶️  Running: xvfb-run ' + args.join(' '));
  console.log('');
  
  try {
    execFileSync('xvfb-run', args, {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch (e) {
    // vitest exits with non-zero on test failure — propagate the exit code
    process.exit(e.status || 1);
  }
}

// ---- Helpers ----
function shellExists(name) {
  try {
    execSync(`command -v ${name}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- Main ----
const xvfbOk = checkXvfb();
if (!xvfbOk) {
  console.error('❌ xvfb installation failed. Aborting.');
  process.exit(1);
}

const viteProcess = ensureDevServer();
runTests(viteProcess);
