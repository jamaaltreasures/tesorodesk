/* Layer: tech grid, drawn on a canvas at devicePixelRatio.
   8px minor / 64px major. Lines are exactly one device pixel and snapped to the
   device-pixel lattice (no blur, no moiré). The origin is aligned to the left edge
   of the content column (.container). A very slow parallax (4% of scroll, snapped)
   runs only when Reduce Motion is off. */
(function () {
  const host = document.querySelector(".layer-grid");
  if (!host || !HTMLCanvasElement.prototype.getContext) return;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;
  host.appendChild(canvas);
  host.classList.add("has-canvas");

  const MINOR = 8, MAJOR = 64;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let dpr = 1, w = 0, h = 0, originX = 0, raf = 0;

  function columnLeft() {
    const c = document.querySelector(".container");
    return c ? c.getBoundingClientRect().left : 0;
  }

  function draw() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    w = window.innerWidth;
    h = window.innerHeight + MAJOR; // one extra major cell for parallax travel
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    canvas.width = W; canvas.height = H;
    canvas.style.width = W / dpr + "px";
    canvas.style.height = H / dpr + "px";
    originX = columnLeft();
    host.style.setProperty("--grid-x", originX + "px");

    ctx.clearRect(0, 0, W, H);
    const step = MINOR * dpr;
    const ox = ((Math.round(originX * dpr) % (MAJOR * dpr)) + MAJOR * dpr) % (MAJOR * dpr);
    const cols = Math.ceil(W / step) + 1, rows = Math.ceil(H / step) + 1;
    const firstCol = -Math.ceil(ox / step);
    // minor
    ctx.fillStyle = "rgba(152,163,173,0.05)";
    for (let i = firstCol; i < cols; i++) {
      const x = Math.round(ox + i * step);
      if ((((i % 8) + 8) % 8) !== 0) ctx.fillRect(x, 0, 1, H);
    }
    for (let j = 0; j < rows; j++) if (j % 8 !== 0) ctx.fillRect(0, Math.round(j * step), W, 1);
    // major
    ctx.fillStyle = "rgba(152,163,173,0.115)";
    for (let i = firstCol; i < cols; i += 1) {
      if ((((i % 8) + 8) % 8) === 0) ctx.fillRect(Math.round(ox + i * step), 0, 1, H);
    }
    for (let j = 0; j < rows; j += 8) ctx.fillRect(0, Math.round(j * step), W, 1);
    // major intersections: tiny plus marks
    ctx.fillStyle = "rgba(241,238,231,0.16)";
    const arm = Math.round(2 * dpr);
    for (let i = firstCol; i < cols; i++) {
      if ((((i % 8) + 8) % 8) !== 0) continue;
      const x = Math.round(ox + i * step);
      for (let j = 0; j < rows; j += 8) {
        const y = Math.round(j * step);
        ctx.fillRect(x - arm, y, arm * 2 + 1, 1);
        ctx.fillRect(x, y - arm, 1, arm * 2 + 1);
      }
    }
    scroll();
  }

  function scroll() {
    raf = 0;
    if (motion.matches) { canvas.style.transform = "none"; return; }
    const travel = (window.scrollY * 0.04) % MAJOR;
    const y = -Math.round(travel * dpr) / dpr; // snap to device pixels
    canvas.style.transform = "translate3d(0," + y + "px,0)";
  }

  let rt = 0;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 80); }, { passive: true });
  window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(scroll); }, { passive: true });
  if (motion.addEventListener) motion.addEventListener("change", scroll);
  // Redraw when the DPR changes (zoom, moving between displays).
  (function watchDpr() {
    const mq = window.matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)");
    const on = () => { draw(); watchDpr(); };
    if (mq.addEventListener) mq.addEventListener("change", on, { once: true });
  })();
  draw();
})();
