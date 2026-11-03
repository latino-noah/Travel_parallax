/* ==========================================================================
   Travel — header: hides while scrolling down, comes back when scrolling up.
   Shared by index.html and your-hike/.
   ========================================================================== */
(() => {
  "use strict";

  const nav = document.querySelector(".nav");
  if (!nav) return;

  const TOP = 80; // above this the header sits transparent over the hero
  const SLACK = 6; // ignore tiny scroll jitter
  let lastY = window.scrollY;
  let ticking = false;

  function update() {
    ticking = false;
    const y = Math.max(0, window.scrollY);
    nav.classList.toggle("is-stuck", y > TOP);
    if (y <= TOP) nav.classList.remove("is-hidden");
    else if (y > lastY + SLACK) nav.classList.add("is-hidden");
    else if (y < lastY - SLACK) nav.classList.remove("is-hidden");
    if (Math.abs(y - lastY) > SLACK || y <= TOP) lastY = y;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  // Keyboard users tabbing into the header should always see it.
  nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));

  update();
})();
