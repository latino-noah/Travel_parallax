/* ==========================================================================
   Travel — hero layout, intro and scroll choreography
   ========================================================================== */
(() => {
  "use strict";

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

  const stage = document.querySelector(".hero__stage");
  const title = document.querySelector(".hero__title");
  const titleInner = title.querySelector(".hero__title-inner");
  const nav = document.querySelector(".nav");

  // Natural size of the mountain photo and where its main summit starts
  // (measured from assets/mountain.png: top of the peak at 43.9% height, 50.5% width).
  const IMG_W = 4096;
  const IMG_H = 2732;
  const PEAK_Y = 0.439;

  // How far the summit should rise into the letters, as a share of cap height.
  const PEAK_OVERLAP = 0.44;

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------------
     Hero layout: size TRAVEL to the viewport and seat it on the summit
     ------------------------------------------------------------------------ */
  const probe = document.createElement("i");
  probe.className = "baseline-probe";
  probe.setAttribute("aria-hidden", "true");
  titleInner.appendChild(probe);

  const canvas = document.createElement("canvas").getContext("2d");

  function layoutHero() {
    const vw = stage.clientWidth;
    const vh = stage.clientHeight;
    const style = getComputedStyle(title);

    // 1. Font size so the word spans ~88% (desktop) / 92% (mobile) of the width.
    title.style.fontSize = "100px";
    const widthAt100 = titleInner.getBoundingClientRect().width / (gsapScaleOf(title) || 1);
    const frac = vw < 760 ? 0.92 : 0.88;
    const size = (vw * frac / widthAt100) * 100;
    title.style.fontSize = `${size.toFixed(2)}px`;

    // 2. Cap height of the rendered word.
    canvas.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    const capH = canvas.measureText("TRAVEL").actualBoundingBoxAscent || size * 0.72;

    // 3. Summit position under object-fit: cover, centred.
    const scale = Math.max(vw / IMG_W, vh / IMG_H);
    const imgH = IMG_H * scale;
    const peakY = (vh - imgH) / 2 + imgH * PEAK_Y;

    // 4. Baseline sits just below the summit so the rock rises through the letters.
    const navBottom = nav.offsetTop + nav.offsetHeight;
    let baseline = peakY + capH * PEAK_OVERLAP;
    baseline = Math.max(baseline, navBottom + 24 + capH);
    baseline = Math.min(baseline, vh * 0.7);

    const baselineOffset = probe.offsetTop; // distance from title box top to baseline
    title.style.top = `${(baseline - baselineOffset).toFixed(1)}px`;
  }

  function gsapScaleOf(el) {
    return hasGsap ? Number(gsap.getProperty(el, "scale")) : 1;
  }

  layoutHero();
  if (document.fonts) {
    document.fonts.ready.then(layoutHero);
    document.fonts.addEventListener("loadingdone", layoutHero);
  }
  window.addEventListener("load", layoutHero);

  let resizeRaf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(layoutHero);
  });

  /* ------------------------------------------------------------------------
     Welcome loader: 15 languages, then the curtain lifts onto the hero
     ------------------------------------------------------------------------ */
  // exitStart: the curtain starts lifting (hero intro begins); done: loader removed, scrolling unlocked.
  const loader = runLoader();

  function runLoader() {
    const el = document.querySelector(".loader");
    let exitStarted, finished;
    const exitStart = new Promise((r) => { exitStarted = r; });
    const done = new Promise((r) => { finished = r; });

    const finish = () => {
      exitStarted();
      if (el) el.remove();
      root.classList.remove("js-loader", "is-loading");
      finished();
    };
    if (!el || !root.classList.contains("js-loader") || !hasGsap) {
      finish();
      return { exitStart, done };
    }

    // The loader covers the top of the page, so that's where the visitor should land.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const words = [...el.querySelectorAll(".loader__words > span")];
    const index = el.querySelector(".loader__index");
    const langName = el.querySelector(".loader__lang");
    const bar = el.querySelector(".loader__bar > span");
    const foot = el.querySelector(".loader__foot");
    const total = words.length;

    // Don't lift the curtain onto half-decoded photos (but never wait more than 3s for them).
    const heroReady = Promise.race([
      Promise.all([...document.querySelectorAll(".hero__layer img")].map((img) => img.decode().catch(() => {}))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);

    if (reduceMotion) {
      // One calm "Welcome", then a plain fade — no cycling, movement or blur.
      gsap.set(bar, { scaleX: 1 });
      const calm = gsap.timeline({ delay: 0.9 });
      calm.addPause(0, () => heroReady.then(() => calm.play()))
        .call(exitStarted)
        .to(el, { opacity: 0, duration: 0.5, ease: "power1.out" })
        .call(finish);
      return { exitStart, done };
    }

    // Kick off the script-font downloads while the Latin words play.
    if (document.fonts) {
      words.forEach((w) => document.fonts.load(`500 1em ${getComputedStyle(w).fontFamily}`, w.textContent).catch(() => {}));
    }

    const HOLD_FIRST = 0.7; // "Welcome" lingers so the sequence has a clear opening
    const HOLD = 0.235;
    const HOLD_LAST = 0.55;

    const tl = gsap.timeline({ delay: 0.15, defaults: { overwrite: "auto" } });
    let t = 0;
    words.forEach((word, i) => {
      if (i > 0) {
        tl.fromTo(word,
          { opacity: 0, yPercent: 38, filter: "blur(10px)" },
          { opacity: 1, yPercent: 0, filter: "blur(0px)", duration: 0.34, ease: "expo.out" }, t);
      }
      tl.call(() => {
        index.textContent = String(i + 1).padStart(2, "0");
        langName.textContent = word.dataset.name;
      }, null, t);
      const hold = i === 0 ? HOLD_FIRST : i === total - 1 ? HOLD_LAST : HOLD;
      tl.to(bar, { scaleX: (i + 1) / total, duration: hold, ease: "power2.out" }, t);
      t += hold;
      if (i < total - 1) {
        tl.to(word, { opacity: 0, yPercent: -38, filter: "blur(10px)", duration: 0.26, ease: "power2.in" }, t - 0.05);
      }
    });

    tl.addPause(t, () => heroReady.then(() => tl.play()))
      // last word drifts up and away with the progress line
      .to(words[total - 1], { opacity: 0, yPercent: -30, filter: "blur(8px)", duration: 0.5, ease: "power2.in" }, t)
      .to(foot, { opacity: 0, y: -8, duration: 0.4, ease: "power2.in" }, t)
      // the curtain lifts; the hero intro starts underneath it
      .call(exitStarted, null, t + 0.3)
      .to(el, { yPercent: -100, duration: 1.15, ease: "expo.inOut" }, t + 0.3)
      .call(finish);

    return { exitStart, done };
  }

  // Smooth scroll via Lenis once it's running; native scrolling otherwise.
  let lenis = null;
  function scrollToTarget(target, offset = 0, onComplete) {
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.6, offset, onComplete });
      return;
    }
    const top = target === 0 ? 0 : target.getBoundingClientRect().top + scrollY + offset;
    window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
    if (onComplete) setTimeout(onComplete, reduceMotion ? 0 : 900);
  }

  /* ------------------------------------------------------------------------
     Booking form
     ------------------------------------------------------------------------ */
  const form = document.getElementById("book-form");
  const field = (name) => form.elements[name];

  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  field("departure").min = today;
  field("return").min = today;
  field("departure").addEventListener("change", () => {
    const dep = field("departure").value;
    field("return").min = dep || today;
    if (field("return").value && field("return").value < dep) field("return").value = "";
  });

  form.querySelectorAll(".stepper").forEach((stepper) => {
    const out = stepper.querySelector("output");
    const [minus, plus] = stepper.querySelectorAll("button");
    const min = Number(stepper.dataset.min);
    const max = Number(stepper.dataset.max);
    const sync = () => {
      minus.setAttribute("aria-disabled", Number(out.value) <= min);
      plus.setAttribute("aria-disabled", Number(out.value) >= max);
    };
    stepper.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-step]");
      if (!btn) return;
      out.value = Math.min(max, Math.max(min, Number(out.value) + Number(btn.dataset.step)));
      sync();
    });
    sync();
  });

  form.addEventListener("input", (e) => {
    if (e.target.value) e.target.removeAttribute("aria-invalid");
  });

  // No booking backend yet: hand the request to the visitor's mail app.
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const missing = ["destination", "departure"].map(field).filter((f) => !f.value.trim());
    ["destination", "departure"].map(field).forEach((f) => f.setAttribute("aria-invalid", missing.includes(f)));
    if (missing.length) {
      missing[0].focus();
      return;
    }
    const v = (name) => field(name).value;
    const body = [
      `Destination: ${v("destination")}`,
      `Departure: ${v("departure")}`,
      `Return: ${v("return") || "One way"}`,
      `Adults: ${v("adults")}`,
      `Children: ${v("children")}`,
      `Trip style: ${v("style")}`,
    ].join("\n");
    form.querySelector(".book__note").textContent = "Opening your email app…";
    window.location.href =
      `mailto:noahda.c@outlook.com?subject=${encodeURIComponent(`Hiking request — ${v("destination")}`)}` +
      `&body=${encodeURIComponent(body)}`;
  });

  /* ------------------------------------------------------------------------
     Destinations carousel
     ------------------------------------------------------------------------ */
  const destTrack = document.querySelector(".dest__track");
  const [prevBtn, nextBtn] = document.querySelectorAll(".dest__nav .arrow");

  function updateDestArrows() {
    const maxScroll = destTrack.scrollWidth - destTrack.clientWidth;
    prevBtn.disabled = destTrack.scrollLeft < 4;
    nextBtn.disabled = destTrack.scrollLeft > maxScroll - 4;
  }
  [prevBtn, nextBtn].forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = destTrack.querySelector(".dest__card");
      const step = card.offsetWidth + parseFloat(getComputedStyle(destTrack).columnGap || 16);
      destTrack.scrollBy({ left: Number(btn.dataset.dir) * step, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });
  destTrack.addEventListener("scroll", updateDestArrows, { passive: true });
  window.addEventListener("resize", updateDestArrows);
  updateDestArrows();

  // Picking a destination or hike fills in the booking form, scrolls there, then focuses the next field.
  // Focus waits for the scroll: focusing a date input mid-animation makes the page jump.
  document.querySelectorAll("[data-destination]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      field("destination").value = link.dataset.destination;
      field("destination").removeAttribute("aria-invalid");
      const next = link.dataset.destination ? field("departure") : field("destination");
      scrollToTarget(form, -100, () => next.focus({ preventScroll: true }));
    });
  });

  /* ------------------------------------------------------------------------
     No GSAP or reduced motion: static, fully visible page
     ------------------------------------------------------------------------ */
  if (!hasGsap || reduceMotion) {
    root.classList.remove("js-anim");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  window.__introStarted = true;

  /* ------------------------------------------------------------------------
     Smooth scrolling (Lenis) driven by GSAP's ticker
     ------------------------------------------------------------------------ */
  if (typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 4) });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    if (root.classList.contains("is-loading")) lenis.stop();
  }
  loader.done.then(() => {
    if (lenis) lenis.start();
    ScrollTrigger.refresh();
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      if (e.defaultPrevented) return;
      const id = link.getAttribute("href");
      const target = id === "#top" ? 0 : document.querySelector(id);
      if (target === null) return;
      e.preventDefault();
      scrollToTarget(target, id === "#book-form" ? -100 : 0);
    });
  });

  /* ------------------------------------------------------------------------
     Intro
     ------------------------------------------------------------------------ */
  const letters = titleInner.querySelectorAll(":scope > span");
  const skyImg = document.querySelector(".hero__sky img");
  const mountainImg = document.querySelector(".hero__mountain img");
  const reveals = document.querySelectorAll("[data-reveal]");

  gsap.set(letters, { yPercent: 38, opacity: 0, filter: "blur(14px)" });
  gsap.set(reveals, { y: 18, opacity: 0 });
  gsap.set(skyImg, { scale: 1.14 });
  gsap.set(mountainImg, { yPercent: 7, scale: 1.05, transformOrigin: "50% 100%" });
  root.classList.remove("js-anim");

  const imagesReady = Promise.all(
    [skyImg, mountainImg].map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()))
  );
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  const timeout = new Promise((r) => setTimeout(r, 1600));

  Promise.all([Promise.race([Promise.all([imagesReady, fontsReady]), timeout]), loader.exitStart]).then(() => {
    layoutHero();
    gsap.timeline({ defaults: { ease: "expo.out" } })
      .to(skyImg, { scale: 1, duration: 2.8 }, 0)
      .to(mountainImg, { yPercent: 0, scale: 1, duration: 2.4 }, 0.05)
      .to(letters, { yPercent: 0, opacity: 1, filter: "blur(0px)", duration: 1.8, stagger: 0.07 }, 0.35)
      .to(reveals, { y: 0, opacity: 1, duration: 1.2, stagger: 0.08, clearProps: "transform" }, 1.0);
  });

  /* ------------------------------------------------------------------------
     Hero parallax — pinned, scrubbed
     ------------------------------------------------------------------------ */
  const vh = () => stage.clientHeight;

  const heroTl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: ".hero",
      start: "top top",
      end: "+=120%",
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
    },
  });

  heroTl
    // sky: barely drifts — the furthest layer
    .to(".hero__sky", { yPercent: -5, scale: 1.04 }, 0)
    // title: sinks slowly so the mountain swallows it
    .to(title, { y: () => vh() * 0.24, scale: 0.94, duration: 1 }, 0)
    .to(title, { opacity: 0, duration: 0.35, ease: "power1.in" }, 0.65)
    // mountain: rises faster and comes closer — the nearest layer
    .to(".hero__mountain", { y: () => -vh() * 0.26, scale: 1.1, duration: 1 }, 0)
    .to(".hero__mountain-base", { opacity: 1, duration: 0.18 }, 0)
    // interface steps aside early
    .to(".hero__ui", { opacity: 0, y: () => -vh() * 0.04, duration: 0.25 }, 0)
    // dusk settles over the scene and hands off to the next section
    .to(".hero__fade", { opacity: 1, duration: 0.55, ease: "power1.inOut" }, 0.45);

  // nav leaves with the interface
  gsap.to(nav, {
    opacity: 0, y: -16, ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "+=25%", scrub: true },
  });

  /* ------------------------------------------------------------------------
     Section reveals
     ------------------------------------------------------------------------ */
  const fades = gsap.utils.toArray("[data-fade]");
  gsap.set(fades, { y: 40, opacity: 0 });
  ScrollTrigger.batch(fades, {
    start: "top 88%",
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { y: 0, opacity: 1, duration: 1.2, ease: "expo.out", stagger: 0.09, overwrite: true }),
  });

  // statement: words light up as you read
  document.querySelectorAll("[data-lines]").forEach((el) => {
    const text = el.textContent.trim();
    el.innerHTML = `<span class="sr-only">${text}</span>` +
      text.split(/\s+/).map((w) => `<span class="w" aria-hidden="true">${w}</span>`).join(" ");
    gsap.fromTo(el.querySelectorAll(".w"),
      { opacity: 0.16 },
      {
        opacity: 1, ease: "none", stagger: 0.1,
        scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 45%", scrub: true },
      });
  });

  // counters
  document.querySelectorAll("[data-count]").forEach((el) => {
    const end = Number(el.dataset.count);
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: "top 90%", once: true,
      onEnter: () => gsap.to(obj, {
        v: end, duration: 2, ease: "expo.out",
        onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString("en-US"); },
      }),
    });
  });

  // booking banner: slow photographic drift
  gsap.fromTo(".book__media",
    { yPercent: -8, scale: 1.08 },
    {
      yPercent: 8, scale: 1, ease: "none",
      scrollTrigger: { trigger: ".book", start: "top bottom", end: "bottom top", scrub: true },
    });


  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
