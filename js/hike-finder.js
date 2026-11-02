/* ==========================================================================
   Travel — "Find your next adventure" questionnaire (homepage section 04)
   One question at a time, answers kept in HikeFinder.Store, then a ranked
   match is saved and the visitor is sent to your-hike/.
   ========================================================================== */
(() => {
  "use strict";

  const HF = window.HikeFinder;
  const root = document.getElementById("hike-finder");
  if (!HF || !root) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  const animate = hasGsap && !reduceMotion;

  const QUESTIONS = HF.QUESTIONS;
  const SUMMARY = QUESTIONS.length; // index of the review step
  const stage = root.querySelector(".finder__stage");
  const count = root.querySelector(".finder__count");
  const fill = root.querySelector(".finder__progress > span");
  const back = root.querySelector(".finder__back");
  const next = root.querySelector(".finder__next");
  const restart = root.querySelector(".finder__restart");

  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

  let state = HF.Store.get();
  let step = Math.min(state.step || 0, SUMMARY);
  let busy = false; // only while handing off to your-hike/
  let transition = null;
  let lastPointer = 0;

  /* ------------------------------------------------------------------------
     Templates
     ------------------------------------------------------------------------ */
  function cardImage(opt) {
    const [trail, i] = opt.img;
    const photo = (window.HIKE_PHOTOS[trail] || [])[i];
    if (!photo) return "";
    const small = photo.src.replace(/\.webp$/, "-640.webp");
    return `<span class="opt__media"><img src="${small}" alt="" loading="lazy" decoding="async"></span>`;
  }

  function questionView(q, index) {
    const current = state.answers[q.key];
    const options = q.options.map((o, i) => `
      <label class="opt${q.visual ? " opt--visual" : ""}" style="--i:${i}">
        <input type="radio" name="hf-${q.key}" value="${esc(o.value)}"${String(current) === String(o.value) ? " checked" : ""}>
        ${q.visual ? cardImage(o) : `<span class="opt__idx">${pad(i + 1)}</span>`}
        <span class="opt__text">
          <span class="opt__label">${esc(o.label)}</span>
          <span class="opt__note">${esc(o.note)}</span>
        </span>
        <span class="opt__check" aria-hidden="true">${CHECK}</span>
      </label>`).join("");
    return `
      <fieldset class="q">
        <legend class="q__legend">
          <span class="q__num">Question ${pad(index + 1)}</span>
          <span class="q__title">${esc(q.title)}</span>
        </legend>
        <div class="q__options${q.visual ? " q__options--visual" : ` q__options--n${q.options.length}`}">${options}</div>
      </fieldset>`;
  }

  function summaryView() {
    const rows = QUESTIONS.map((q, i) => `
      <li class="sum__row" style="--i:${i}">
        <span class="sum__q">${pad(i + 1)} · ${esc(q.title)}</span>
        <span class="sum__a">${esc(HF.option(q.key, state.answers[q.key]).label)}</span>
        <button type="button" class="sum__edit" data-goto="${i}" aria-label="Change answer: ${esc(q.title)}">Change</button>
      </li>`).join("");
    return `
      <div class="q q--summary">
        <p class="q__legend">
          <span class="q__num">Your adventure profile</span>
          <span class="q__title">Everything look right?</span>
        </p>
        <ul class="sum">${rows}</ul>
        <button type="button" class="finder__go">Find my perfect hike ${ARROW}</button>
        <p class="finder__fine">We compare your answers with ${HF.TRAILS.length} guided trails, from Lofoten to the Amalfi Coast.</p>
      </div>`;
  }

  /* ------------------------------------------------------------------------
     Rendering & transitions
     ------------------------------------------------------------------------ */
  function updateChrome() {
    const done = QUESTIONS.filter((q) => state.answers[q.key] !== undefined).length;
    count.innerHTML = step === SUMMARY ? `<b>Ready</b> · ${SUMMARY}/${SUMMARY}` : `<b>${pad(step + 1)}</b> / ${pad(SUMMARY)}`;
    const progress = step === SUMMARY ? 1 : (step + (state.answers[QUESTIONS[step].key] !== undefined ? 1 : 0)) / SUMMARY;
    if (animate) gsap.to(fill, { scaleX: progress, duration: 0.9, ease: "expo.out" });
    else fill.style.transform = `scaleX(${progress})`;
    back.disabled = step === 0;
    back.hidden = false;
    next.hidden = step === SUMMARY;
    next.disabled = step < SUMMARY && state.answers[QUESTIONS[step].key] === undefined;
    restart.hidden = done === 0;
    root.dataset.step = step === SUMMARY ? "summary" : QUESTIONS[step].key;
  }

  function build() {
    const view = document.createElement("div");
    view.className = "finder__view";
    view.innerHTML = step === SUMMARY ? summaryView() : questionView(QUESTIONS[step], step);
    return view;
  }

  function render(dir = 0, focus = false) {
    // A click mid-transition fast-forwards the running one instead of being ignored.
    if (transition) transition.progress(1);
    const views = stage.querySelectorAll(".finder__view");
    views.forEach((v, i) => { if (i < views.length - 1) v.remove(); });
    stage.style.height = "";
    const old = views[views.length - 1];
    if (old) old.removeAttribute("style");
    const view = build();
    updateChrome();
    HF.Store.set({ step });

    const settle = () => {
      if (old) old.remove();
      view.style.position = "";
      if (focus) {
        const target = view.querySelector("input:checked") || view.querySelector("input, .finder__go");
        if (target) target.focus({ preventScroll: true });
      }
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    };

    if (!old || !animate || dir === 0) {
      stage.appendChild(view);
      settle();
      return;
    }

    // Keep the stage height while the two views cross over.
    stage.style.height = `${stage.offsetHeight}px`;
    old.style.position = "absolute";
    old.style.inset = "0 0 auto 0";
    stage.appendChild(view);
    const items = view.querySelectorAll(".opt, .sum__row, .finder__go");
    transition = gsap.timeline({ onComplete: () => { transition = null; } })
      .to(old, { opacity: 0, x: -40 * dir, filter: "blur(6px)", duration: 0.45, ease: "power2.in" }, 0)
      .to(stage, { height: view.offsetHeight, duration: 0.7, ease: "expo.inOut", clearProps: "height" }, 0.1)
      .from(view.querySelector(".q__legend"), { opacity: 0, x: 50 * dir, duration: 0.9, ease: "expo.out" }, 0.3)
      .from(items, { opacity: 0, y: 26, scale: 0.97, duration: 0.85, ease: "expo.out", stagger: 0.05 }, 0.38)
      .add(settle, 0.45);
  }

  function go(to, focus = true) {
    if (busy || to === step || to < 0 || to > SUMMARY) return;
    // Never skip past an unanswered question.
    const firstOpen = QUESTIONS.findIndex((q) => state.answers[q.key] === undefined);
    if (firstOpen !== -1 && to > firstOpen) to = firstOpen;
    const dir = to > step ? 1 : -1;
    step = to;
    render(dir, focus);
  }

  function nextStep() {
    const firstOpen = QUESTIONS.findIndex((q, i) => i > step && state.answers[q.key] === undefined);
    // After editing an answer from the summary, return straight to it.
    go(firstOpen === -1 ? SUMMARY : Math.min(step + 1, firstOpen));
  }

  /* ------------------------------------------------------------------------
     Events
     ------------------------------------------------------------------------ */
  stage.addEventListener("pointerdown", () => { lastPointer = performance.now(); });

  stage.addEventListener("change", (e) => {
    const input = e.target;
    if (!input.matches("input[type=radio]")) return;
    const q = QUESTIONS[step];
    const value = typeof q.options[0].value === "number" ? Number(input.value) : input.value;
    state = HF.Store.set({ answers: { ...state.answers, [q.key]: value }, result: null });
    updateChrome();
    const card = input.closest(".opt");
    if (animate) gsap.fromTo(card, { scale: 0.97 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.5)", clearProps: "scale" });
    // Clicking a card moves on by itself; keyboard users keep control with Next.
    if (performance.now() - lastPointer < 800) setTimeout(() => { if (QUESTIONS[step] === q) nextStep(); }, animate ? 420 : 150);
  });

  stage.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-goto]");
    if (edit) go(Number(edit.dataset.goto));
    if (e.target.closest(".finder__go")) submit();
  });

  back.addEventListener("click", () => go(step - 1));
  next.addEventListener("click", nextStep);
  restart.addEventListener("click", () => {
    HF.Store.reset();
    state = HF.Store.get();
    const dir = step === 0 ? 0 : -1;
    step = 0;
    render(dir, true);
  });

  /* ------------------------------------------------------------------------
     Submit: rank the trails, save, then a short "matching" overlay into your-hike/
     ------------------------------------------------------------------------ */
  function submit() {
    if (busy || !HF.isComplete(state.answers)) return;
    busy = true;
    const ranked = HF.rank(state.answers);
    const top = ranked.slice(0, 4).map(({ id, percent }) => ({ id, percent }));
    HF.Store.set({ result: { top, selected: top[0].id, at: Date.now() }, step: SUMMARY });

    const overlay = matchingOverlay(ranked);
    document.body.appendChild(overlay);
    if (window.__lenis) window.__lenis.stop();
    const leave = () => { window.location.href = "your-hike/"; };
    if (!animate) { setTimeout(leave, 300); return; }

    const names = overlay.querySelectorAll(".matching__name");
    const counter = overlay.querySelector(".matching__n");
    const tick = { n: 0 };
    const tl = gsap.timeline({ onComplete: leave });
    tl.fromTo(overlay, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 0.9, ease: "expo.inOut" })
      .from(overlay.querySelectorAll(".matching__label, .matching__title"), { y: 30, opacity: 0, stagger: 0.08, duration: 0.8, ease: "expo.out" }, 0.45)
      .to(tick, { n: ranked.length, duration: 1.6, ease: "power2.inOut", onUpdate: () => { counter.textContent = Math.round(tick.n); } }, 0.6)
      .to(overlay.querySelector(".matching__bar > span"), { scaleX: 1, duration: 1.6, ease: "power2.inOut" }, 0.6);
    names.forEach((el, i) => {
      tl.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 0.6 + i * 0.16)
        .to(el, { opacity: 0, y: -14, duration: 0.14, ease: "power2.in" }, 0.6 + i * 0.16 + 0.14);
    });
    tl.to(overlay.querySelector(".matching__inner"), { opacity: 0, y: -20, duration: 0.45, ease: "power2.in" }, "+=0.15");
  }

  function matchingOverlay(ranked) {
    const el = document.createElement("div");
    el.className = "matching";
    el.setAttribute("role", "status");
    // A sample of the trails actually compared, ending on the winner's runner-ups.
    const shown = ranked.slice(1, 10).reverse().map((r) => HF.trailById(r.id).name);
    el.innerHTML = `
      <div class="matching__inner">
        <p class="matching__label">Matching your answers</p>
        <p class="matching__title">Finding your trail</p>
        <p class="matching__names" aria-hidden="true">${shown.map((n) => `<span class="matching__name">${esc(n)}</span>`).join("")}</p>
        <div class="matching__foot">
          <span><span class="matching__n">0</span> / ${ranked.length} trails compared</span>
          <span class="matching__bar"><span></span></span>
        </div>
      </div>`;
    return el;
  }

  /* ------------------------------------------------------------------------
     Presets from elsewhere on the page (e.g. the destination map)
     ------------------------------------------------------------------------ */
  window.HikeFinderUI = {
    preset(answers) {
      if (busy) return;
      state = HF.Store.set({ answers: { ...state.answers, ...answers }, result: null });
      const open = QUESTIONS.findIndex((q) => state.answers[q.key] === undefined);
      const to = open === -1 ? SUMMARY : open;
      const dir = to === step ? 0 : to > step ? 1 : -1;
      step = to;
      render(dir);
    },
  };

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  // A step past the first unanswered question can't be shown.
  const firstOpen = QUESTIONS.findIndex((q) => state.answers[q.key] === undefined);
  if (firstOpen !== -1 && step > firstOpen) step = firstOpen;
  render(0);
})();
