// Fit the 1280 × 800 layout to smaller screens by zooming the whole page down evenly.
// An 8" tablet (e.g. TCL Tab 8 Gen 2) gives the browser about 960 × 600 CSS pixels, which would otherwise
// overflow the layout. Larger screens are left at 100%. Add ?size to the address to show what the screen reports.
import { params } from './hub';

const DESIGN_W = 1280;
const DESIGN_H = 800;

export function fitToScreen(): void {
  const badge = params.has('size') ? document.body.appendChild(document.createElement('div')) : null;
  if (badge) badge.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;padding:4px 10px;border-radius:8px;'
    + 'background:rgba(0,0,0,.7);color:#fff;font:600 13px/1.4 system-ui,sans-serif;pointer-events:none';

  const apply = () => {
    const w = window.innerWidth, h = window.innerHeight;
    let scale = Math.min(1, w / DESIGN_W, h / DESIGN_H);
    // A pixel or two short (e.g. 1280 × 799 on an 11" tablet) isn't worth zooming: 0.999 just blurs the text.
    if (scale > 0.98) scale = 1;
    // CSS zoom (not transform) so layout, hit areas and fixed overlays all scale together.
    document.documentElement.style.zoom = scale < 1 ? String(Math.floor(scale * 1000) / 1000) : '';
    if (badge) badge.textContent = `${w} × ${h} @ ${window.devicePixelRatio}x · zoom ${scale < 1 ? scale.toFixed(3) : '1 (fits)'}`;
  };
  apply();
  window.addEventListener('resize', apply);
}
