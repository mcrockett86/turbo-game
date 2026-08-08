/**
 * Analyze diagnostic screenshots with pngjs
 */
import { PNG } from '/home/manager/turbo-game/turbo-web/node_modules/pngjs/lib/png.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OUTPUT_DIR = '/home/manager/turbo-game/turbo-web/diagnostic-output';

function analyzePNG(path) {
  return new Promise((resolve, reject) => {
    try {
      const data = readFileSync(path);
      const png = new PNG();
      let result = null;
      
      png.on('parsed', function() {
        let blackCount = 0, totalPixels = png.width * png.height;
        let sumR = 0, sumG = 0, sumB = 0;
        let maxR = 0, maxG = 0, maxB = 0;
        const colorSet = new Set();
        
        for (let y = 0; y < png.height; y++) {
          for (let x = 0; x < png.width; x++) {
            const idx = (y * png.width + x) * 4;
            const r = png.data[idx], g = png.data[idx + 1], b = png.data[idx + 2], a = png.data[idx + 3];
            sumR += r; sumG += g; sumB += b;
            maxR = Math.max(maxR, r); maxG = Math.max(maxG, g); maxB = Math.max(maxB, b);
            if (r < 15 && g < 15 && b < 15 && a > 10) blackCount++;
            if (a > 10) colorSet.add(r + ',' + g + ',' + b);
          }
        }
        
        result = {
          blackPct: (blackCount / totalPixels) * 100,
          hasContent: maxR > 50 || maxG > 50 || maxB > 50,
          avgR: Math.round(sumR / totalPixels),
          avgG: Math.round(sumG / totalPixels),
          avgB: Math.round(sumB / totalPixels),
          maxR, maxG, maxB,
          uniqueColors: colorSet.size,
          sampleColors: Array.from(colorSet).slice(0, 15),
        };
        resolve(result);
      });
      
      png.on('error', reject);
      png.parse(data);
    } catch (e) {
      reject(e);
    }
  });
}

async function run() {
  const files = readdirSync(OUTPUT_DIR).filter(f => f.startsWith('phase') && f.endsWith('.png'));
  files.sort();
  
  console.log('═══════════════════════════════════════════');
  console.log('  Screenshot Pixel Analysis');
  console.log('═══════════════════════════════════════════\n');
  
  const results = [];
  
  for (const file of files) {
    const path = join(OUTPUT_DIR, file);
    const stats = readFileSync(path);
    
    try {
      const analysis = await analyzePNG(path);
      analysis.fileSize = stats.length;
      results.push({ file, ...analysis });
      
      console.log(`📷 ${file} (${stats.length} bytes):`);
      console.log(`   Black pixels: ${analysis.blackPct.toFixed(1)}%`);
      console.log(`   Has content: ${analysis.hasContent}`);
      console.log(`   Avg color: rgb(${analysis.avgR}, ${analysis.avgG}, ${analysis.avgB})`);
      console.log(`   Max color: rgb(${analysis.maxR}, ${analysis.maxG}, ${analysis.maxB})`);
      console.log(`   Unique colors: ${analysis.uniqueColors}`);
      console.log(`   Samples: ${analysis.sampleColors.join(', ')}`);
      console.log('');
    } catch (e) {
      console.log(`❌ ${file}: ${e.message}\n`);
    }
  }
  
  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════');
  
  const allGood = results.every(r => r.hasContent && r.blackPct < 99 && r.uniqueColors > 1);
  console.log(`\nFiles analyzed: ${results.length}`);
  console.log(`All have content: ${results.every(r => r.hasContent)}`);
  console.log(`Black < 99%: ${results.every(r => r.blackPct < 99)}`);
  console.log(`Multiple colors: ${results.every(r => r.uniqueColors > 1)}`);
  
  if (allGood) {
    console.log('\n✅ All screenshots show rendered content!');
  } else {
    const issues = [];
    if (!results.every(r => r.hasContent)) issues.push('some have no content');
    if (!results.every(r => r.blackPct < 99)) issues.push('some are too black');
    if (!results.every(r => r.uniqueColors > 1)) issues.push('some have only 1 color');
    console.log(`\n⚠️  Issues: ${issues.join(', ')}`);
  }
}

run();
