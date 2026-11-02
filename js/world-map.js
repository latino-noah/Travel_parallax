/* ==========================================================================
   Travel — "Explore by destination" world map.
   assets/world-map.svg holds Natural Earth country outlines pre-projected
   (Natural Earth I); markers are placed here with the same projection.
   ========================================================================== */
(() => {
  "use strict";

  const section = document.getElementById("explore");
  const data = window.DESTINATION_DATA;
  if (!section || !data) return;

  const { CONTINENTS, DESTINATIONS } = data;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = typeof window.gsap !== "undefined" && !reduceMotion;
  const NS = "http://www.w3.org/2000/svg";

  const stage = section.querySelector(".atlas__stage");
  const holder = section.querySelector(".atlas__map");
  const tip = section.querySelector(".atlas__tip");
  const panel = section.querySelector(".atlas__panel");
  const filters = section.querySelector(".atlas__filters");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  let svg, full, vb, pins = [];
  let current = "all";
  let openId = null;

  /* ------------------------------------------------------------------------
     Projection — d3.geoNaturalEarth1 raw formula with the build's scale/translate
     ------------------------------------------------------------------------ */
  let P = { k: 1, tx: 0, ty: 0 };
  function project(lng, lat) {
    const l = (lng * Math.PI) / 180;
    const p = (lat * Math.PI) / 180;
    const p2 = p * p, p4 = p2 * p2;
    const x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
    const y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
    return [P.tx + P.k * x, P.ty - P.k * y];
  }

  function photoOf(d) {
    if (Array.isArray(d.photo)) {
      const [trail, i] = d.photo;
      return ((window.HIKE_PHOTOS || {})[trail] || [])[i];
    }
    return (window.DESTINATION_PHOTOS || {})[d.photo];
  }

  /* ------------------------------------------------------------------------
     Build
     ------------------------------------------------------------------------ */
  fetch(holder.dataset.src)
    .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
    .then((text) => {
      holder.innerHTML = text;
      svg = holder.querySelector("svg");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      P = { k: Number(svg.dataset.scale), tx: Number(svg.dataset.tx), ty: Number(svg.dataset.ty) };
      const [, , w, h] = svg.getAttribute("viewBox").split(" ").map(Number);
      full = { x: 0, y: 0, w, h };
      vb = { ...full };
      buildPins();
      fitView(current, false);
      section.classList.add("is-ready");
      if (animate) intro();
    })
    .catch(() => {
      holder.innerHTML = '<p class="atlas__error">The map couldn\'t load. Refresh the page to try again.</p>';
    });

  function buildPins() {
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML = `<radialGradient id="pin-glow"><stop offset="0" stop-color="#ff9a3c" stop-opacity="0.55"/><stop offset="0.45" stop-color="#ff8a2a" stop-opacity="0.18"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></radialGradient>`;
    svg.prepend(defs);
    const layer = document.createElementNS(NS, "g");
    layer.setAttribute("class", "atlas__pins");
    svg.appendChild(layer);

    pins = DESTINATIONS.map((d, i) => {
      const [x, y] = project(d.lng, d.lat);
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "pin");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `${d.name}, ${d.country}`);
      g.dataset.id = d.id;
      g.style.setProperty("--delay", `${(i % 7) * -0.43}s`);
      g.innerHTML = `
        <g class="pin__pos">
          <g class="pin__body"><g class="pin__hover">
            <circle class="pin__halo" r="14" fill="url(#pin-glow)"/>
            <circle class="pin__pulse" r="4.5"/>
            <circle class="pin__core" r="3.6"/>
            <circle class="pin__hit" r="11"/>
          </g></g>
        </g>`;
      layer.appendChild(g);
      return { d, g, pos: g.firstElementChild, x, y };
    });
    placePins();
  }

  // Markers keep the same on-screen size at any zoom level or screen width.
  function placePins() {
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const unitsPerPx = Math.max(vb.w / box.width, vb.h / box.height);
    pins.forEach((p) => p.pos.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${unitsPerPx})`));
    // Close neighbours (the Alps) share the space between them instead of covering each other.
    const shown = pins.filter((p) => !p.g.classList.contains("is-hidden"));
    shown.forEach((p) => {
      const gap = Math.min(...shown.filter((q) => q !== p).map((q) => Math.hypot(q.x - p.x, q.y - p.y) / unitsPerPx));
      p.g.querySelector(".pin__hit").setAttribute("r", Math.max(4, Math.min(12, gap / 2)).toFixed(1));
    });
    if (openId === null) hideTip();
  }

  /* ------------------------------------------------------------------------
     Views & filtering
     ------------------------------------------------------------------------ */
  function boundsOf(id) {
    const c = CONTINENTS.find((x) => x.id === id);
    if (!c || !c.view) return { ...full };
    const [w, s, e, n] = c.view;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const lng = w + ((e - w) * i) / 8;
      const lat = s + ((n - s) * i) / 8;
      pts.push(project(lng, s), project(lng, n), project(w, lat), project(e, lat));
    }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  // Expand a box to the stage's aspect ratio so nothing is letterboxed.
  function fitAspect(b) {
    const box = svg.getBoundingClientRect();
    const aspect = box.width / box.height;
    let { x, y, w, h } = b;
    if (w / h < aspect) { const nw = h * aspect; x -= (nw - w) / 2; w = nw; }
    else { const nh = w / aspect; y -= (nh - h) / 2; h = nh; }
    return { x, y, w, h };
  }

  function fitView(id, tween = true) {
    const target = fitAspect(boundsOf(id));
    const apply = () => {
      svg.setAttribute("viewBox", `${vb.x.toFixed(2)} ${vb.y.toFixed(2)} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`);
      placePins();
    };
    if (!tween || !animate) {
      Object.assign(vb, target);
      apply();
      return;
    }
    gsap.to(vb, { ...target, duration: 1.4, ease: "expo.inOut", overwrite: true, onUpdate: apply });
  }

  function setFilter(id) {
    if (id === current || !svg) return;
    current = id;
    filters.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === id)));
    closePanel();
    pins.forEach((p, i) => {
      const show = id === "all" || p.d.continent === id;
      p.g.classList.toggle("is-hidden", !show);
      if (!show && p.g.contains(document.activeElement)) p.g.blur();
      p.g.setAttribute("tabindex", show ? "0" : "-1");
      p.g.setAttribute("aria-hidden", String(!show));
      if (animate) {
        gsap.to(p.g.querySelector(".pin__body"), {
          scale: show ? 1 : 0, opacity: show ? 1 : 0, transformOrigin: "50% 50%",
          duration: show ? 0.8 : 0.4, delay: show ? 0.5 + i * 0.02 : 0, ease: show ? "back.out(2.2)" : "power2.in",
        });
      }
    });
    fitView(id);
  }

  /* ------------------------------------------------------------------------
     Tooltip & panel
     ------------------------------------------------------------------------ */
  function pinPoint(pin) {
    const r = pin.g.querySelector(".pin__core").getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
  }

  function showTip(pin) {
    const { x, y } = pinPoint(pin);
    tip.innerHTML = `<b>${esc(pin.d.name)}</b><span>${esc(pin.d.country)}</span>`;
    tip.hidden = false;
    tip.style.transform = `translate(${x}px, ${y}px)`;
    tip.classList.toggle("is-left", x > stage.clientWidth - 160);
  }
  function hideTip() { tip.hidden = true; }

  function openPanel(pin) {
    const d = pin.d;
    const photo = photoOf(d);
    const regionLabel = { alps: "the Alps", scandinavia: "Scandinavia", southern: "Southern Europe", europe: "Anywhere in Europe", worldwide: "Worldwide" }[d.region];
    panel.innerHTML = `
      <button type="button" class="atlas__close" aria-label="Close">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      ${photo ? `<figure class="atlas__photo"><img src="${esc(photo.src)}" alt="${esc(photo.alt)}" decoding="async"></figure>` : ""}
      <div class="atlas__body">
        <p class="atlas__country">${esc(d.country)} · ${esc(CONTINENTS.find((c) => c.id === d.continent).label)}</p>
        <h3 class="atlas__name" id="atlas-name">${esc(d.name)}</h3>
        <p class="atlas__desc">${esc(d.description)}</p>
        <a class="atlas__cta" href="#plan" data-region="${d.region}">
          Explore destination
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <p class="atlas__fine">Opens the trail finder with ${esc(regionLabel)} selected.</p>
      </div>`;
    panel.setAttribute("aria-labelledby", "atlas-name");
    const wasOpen = openId !== null;
    openId = d.id;
    pins.forEach((p) => p.g.classList.toggle("is-active", p === pin));
    panel.hidden = false;
    hideTip();
    if (animate) {
      gsap.fromTo(panel, { opacity: 0, x: wasOpen ? 0 : 30, y: wasOpen ? 10 : 0 }, { opacity: 1, x: 0, y: 0, duration: 0.7, ease: "expo.out" });
      gsap.fromTo(panel.querySelectorAll(".atlas__body > *"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.05, delay: 0.1 });
      const img = panel.querySelector(".atlas__photo img");
      if (img) gsap.fromTo(img, { scale: 1.12 }, { scale: 1, duration: 1.4, ease: "expo.out" });
    }
    panel.querySelector(".atlas__close").focus({ preventScroll: true });
  }

  function closePanel(returnFocus = false) {
    if (openId === null) return;
    const pin = pins.find((p) => p.d.id === openId);
    openId = null;
    pins.forEach((p) => p.g.classList.remove("is-active"));
    const done = () => { panel.hidden = true; panel.innerHTML = ""; };
    if (animate) gsap.to(panel, { opacity: 0, x: 20, duration: 0.35, ease: "power2.in", onComplete: done });
    else done();
    if (returnFocus && pin) pin.g.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------------
     Events
     ------------------------------------------------------------------------ */
  const pinFrom = (el) => {
    const g = el.closest && el.closest(".pin");
    return g && pins.find((p) => p.g === g);
  };

  holder.addEventListener("pointerover", (e) => {
    const pin = pinFrom(e.target);
    if (pin && e.pointerType !== "touch") showTip(pin);
  });
  holder.addEventListener("pointerout", (e) => {
    const pin = pinFrom(e.target);
    if (pin && !pin.g.contains(e.relatedTarget)) hideTip();
  });
  holder.addEventListener("focusin", (e) => { const pin = pinFrom(e.target); if (pin) showTip(pin); });
  holder.addEventListener("focusout", hideTip);
  holder.addEventListener("click", (e) => {
    const pin = pinFrom(e.target);
    if (pin) openPanel(pin);
    else closePanel();
  });
  holder.addEventListener("keydown", (e) => {
    const pin = pinFrom(e.target);
    if (pin && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openPanel(pin); }
  });

  panel.addEventListener("click", (e) => {
    if (e.target.closest(".atlas__close")) closePanel(true);
    const cta = e.target.closest(".atlas__cta");
    if (!cta) return;
    // Preset after arriving: re-rendering the finder mid-scroll would make ScrollTrigger re-measure under Lenis.
    const preset = () => window.HikeFinderUI && window.HikeFinderUI.preset({ region: cta.dataset.region });
    const target = document.getElementById("plan");
    if (window.__lenis && target) {
      e.preventDefault();
      // Absolute target from the real scroll position: Lenis' own can lag after native (focus) scrolling.
      window.__lenis.scrollTo(target.getBoundingClientRect().top + window.scrollY, { duration: 1.6, onComplete: preset });
    } else {
      preset();
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(true); });

  filters.addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (b) setFilter(b.dataset.filter);
  });

  let resizeRaf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => { if (svg) fitView(current, false); });
  });

  /* ------------------------------------------------------------------------
     Entrance: countries fade up, then the markers light up one by one
     ------------------------------------------------------------------------ */
  function intro() {
    const countries = svg.querySelector(".world__countries");
    const bodies = pins.map((p) => p.g.querySelector(".pin__body"));
    gsap.set(countries, { opacity: 0 });
    gsap.set(bodies, { scale: 0, opacity: 0, transformOrigin: "50% 50%" });
    const run = () => gsap.timeline()
      .to(countries, { opacity: 1, duration: 1.6, ease: "power2.out" })
      .to(bodies, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(2.4)", stagger: { each: 0.06, from: "random" } }, 0.5);
    if (typeof window.ScrollTrigger !== "undefined") ScrollTrigger.create({ trigger: stage, start: "top 75%", once: true, onEnter: run });
    else run();
  }
})();
