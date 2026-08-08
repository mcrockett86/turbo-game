# Three.js Diagnostic — Test Results

## Root Cause Found

**The diagnostic test itself was breaking Three.js!**

### The Problem
Our Playwright test was calling `canvas.getContext('2d')` to read pixels via `getImageData()`. This created a 2D context on the canvas, which caused Three.js to fail:

```
THREE.WebGLRenderer: A WebGL context could not be created. 
Reason: Canvas has an existing context of a different type
```

This destroyed the WebGL context → nothing rendered → 100% black screenshots.

### The Fix
Use `canvas.transferToImageBitmap()` + `OffscreenCanvas` to read pixels without creating a 2D context on the WebGL canvas.

## Results (After Fix)

| Phase | Black % | Unique Colors | Has Content |
|-------|---------|--------------|-------------|
| Phase 1 (static) | 13.4% | 5,501 | ✅ |
| Phase 2 (orbit) | 13.3% | 6,377 | ✅ |
| Phase 3 (vertical) | 16.3% | 4,195 | ✅ |
| Phase 4 (close-up) | 13.4% | 5,015 | ✅ |
| Phase 5 (proximity) | 11.6% | 7,474 | ✅ |
| Phase 6 (full sweep) | 14.3% | 6,324 | ✅ |

### Key Findings
- ✅ **All 6 phases show rendered content** (not black)
- ✅ **11-16% black pixels** — normal for a dark scene with sky background
- ✅ **4,000-7,500 unique colors per frame** — rich rendering
- ✅ **Camera movement is working** — different color distributions per phase
- ✅ **WebGL 2.0 context** — WebKit WebGL on Chromium
- ✅ **No Three.js errors** (after fix)

## What This Tells Us

The Three.js diagnostic HTML works correctly. The earlier "black screen" was a testing artifact, not a rendering bug.

If you're seeing black in your actual application, the issue is likely:
1. **Camera position** — camera inside geometry or behind near-plane
2. **Lighting** — no lights or wrong light types for your materials
3. **Scene objects** — geometry not added or wrong scale
4. **Renderer init** — canvas dimensions are 0 or WebGL not supported

## Files Created

- `threejs-diagnostic.html` — The interactive diagnostic
- `test-threejs-diagnostic.js` — Playwright test (fixed version)
- `analyze-screenshots.js` — PNG pixel analysis with pngjs
- `diagnostic-output/` — 6 screenshots + JSON report
