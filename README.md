# Travel_parallax

Guided hiking holidays landing page with a multilingual welcome loader,
a layered parallax hero
(sky → "TRAVEL" → mountain → interface), built with plain HTML/CSS/JS,
GSAP + ScrollTrigger and Lenis smooth scrolling (loaded from jsDelivr).

## Run

Any static server works, e.g.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure

- `index.html` — markup for the hero and content sections
- `css/style.css` — layout, layering, responsive rules, reduced-motion rules
- `js/main.js` — sizes/positions the headline on the summit, intro, scroll choreography
- `assets/` — original photos; `assets/img/` — optimized WebP versions used by the site
- `assets/img/dest/` — destination photos (your own pics + Wikimedia Commons photos; credits are listed in the site footer)
