/* ==========================================================================
   Travel — mountain destinations for the "Explore by destination" map.
   lat/lng point at the destination's best-known peak or hiking base.
   photo: a key in DESTINATION_PHOTOS, or [trail id, index] into HIKE_PHOTOS.
   region: the trail-finder answer the "Explore destination" button presets.
   ========================================================================== */
(() => {
  "use strict";

  const CONTINENTS = [
    { id: "all", label: "All destinations" },
    { id: "europe", label: "Europe", view: [-1, 41, 26, 61] },
    { id: "asia", label: "Asia", view: [55, 10, 148, 52] },
    { id: "north-america", label: "North America", view: [-135, 22, -60, 62] },
    { id: "south-america", label: "South America", view: [-90, -56, -32, 8] },
    { id: "africa", label: "Africa", view: [-20, -30, 52, 37] },
    { id: "oceania", label: "Oceania", view: [110, -48, 180, -8] },
  ];

  const DESTINATIONS = [
    { id: "swiss-alps", name: "Swiss Alps", country: "Switzerland", continent: "europe", lat: 46.54, lng: 7.96, region: "alps", photo: ["eiger", 0],
      description: "Glaciers, cogwheel railways and the Eiger, Mönch and Jungfrau above Grindelwald — the Alps at their most iconic." },
    { id: "dolomites", name: "Dolomites", country: "Italy", continent: "europe", lat: 46.41, lng: 11.84, region: "alps", photo: ["tre-cime", 0],
      description: "Pale limestone towers above high meadows in South Tyrol and the Veneto — a UNESCO World Heritage site laced with huts and via ferratas." },
    { id: "mont-blanc", name: "Mont Blanc", country: "France · Italy", continent: "europe", lat: 45.83, lng: 6.86, region: "alps", photo: ["tmb", 0],
      description: "Western Europe's highest summit (≈ 4,806 m), circled by the Tour du Mont Blanc through France, Italy and Switzerland." },
    { id: "norwegian-fjords", name: "Norwegian Fjords", country: "Norway", continent: "europe", lat: 59.0, lng: 6.19, region: "scandinavia", photo: ["preikestolen", 0],
      description: "Sheer cliffs dropping into deep fjords, with classic hikes to Preikestolen and Trolltunga." },
    { id: "pyrenees", name: "Pyrenees", country: "France · Spain", continent: "europe", lat: 42.63, lng: 0.66, region: "southern", photo: "pyrenees",
      description: "A wild range along the French–Spanish border, crossed end to end by the GR10 and topped by Aneto (3,404 m)." },
    { id: "austrian-alps", name: "Austrian Alps", country: "Austria", continent: "europe", lat: 47.07, lng: 12.69, region: "alps", photo: "austrian-alps",
      description: "High Tauern scenery around the Grossglockner, Austria's highest peak (3,798 m), with the Pasterze glacier at its foot." },
    { id: "julian-alps", name: "Julian Alps", country: "Slovenia", continent: "europe", lat: 46.38, lng: 13.84, region: "alps", photo: "julian-alps",
      description: "Slovenia's limestone mountains around Triglav (2,864 m), with emerald rivers and Lake Bohinj below." },
    { id: "carpathians", name: "Carpathian Mountains", country: "Romania", continent: "europe", lat: 45.6, lng: 24.74, region: "europe", photo: "carpathians",
      description: "The Făgăraș ridge, highest in the Southern Carpathians, with glacial lakes and long, quiet ridge walks." },
    { id: "himalayas", name: "Himalayas", country: "Nepal", continent: "asia", lat: 27.99, lng: 86.93, region: "worldwide", photo: ["everest-bc", 0],
      description: "The Khumbu valley beneath Everest (8,849 m), where Sherpa villages and monasteries line the trail to Base Camp." },
    { id: "annapurna", name: "Annapurna", country: "Nepal", continent: "asia", lat: 28.6, lng: 83.82, region: "worldwide", photo: "annapurna",
      description: "The Annapurna massif in central Nepal, home to the Annapurna Circuit and the trek to Annapurna Base Camp." },
    { id: "mount-fuji", name: "Mount Fuji", country: "Japan", continent: "asia", lat: 35.36, lng: 138.73, region: "worldwide", photo: ["fuji", 1],
      description: "Japan's highest mountain (3,776 m), climbed in summer for sunrise from the crater rim." },
    { id: "tian-shan", name: "Tian Shan", country: "Kyrgyzstan", continent: "asia", lat: 42.17, lng: 78.55, region: "worldwide", photo: "tian-shan",
      description: "The \"Celestial Mountains\": turquoise lakes like Ala-Kul, yurt camps and very few other hikers." },
    { id: "rockies", name: "Rocky Mountains", country: "Canada · USA", continent: "north-america", lat: 51.32, lng: -116.18, region: "worldwide", photo: "rockies",
      description: "Turquoise lakes and glaciated peaks in Banff and Jasper, in a range that runs from Canada deep into the USA." },
    { id: "yosemite", name: "Yosemite", country: "USA", continent: "north-america", lat: 37.75, lng: -119.59, region: "worldwide", photo: "yosemite",
      description: "Granite walls, waterfalls and giant sequoias in California's Sierra Nevada, with El Capitan and Half Dome above the valley." },
    { id: "patagonia", name: "Patagonia", country: "Argentina · Chile", continent: "south-america", lat: -50.0, lng: -73.1, region: "worldwide", photo: ["w-trek", 0],
      description: "Granite towers, glaciers and wind at the southern tip of South America, from Torres del Paine to Fitz Roy." },
    { id: "andes", name: "Andes", country: "Peru", continent: "south-america", lat: -9.1, lng: -77.6, region: "worldwide", photo: "andes",
      description: "The Cordillera Blanca, the world's highest tropical mountain range, with glacier lakes and the Santa Cruz trek." },
    { id: "kilimanjaro", name: "Mount Kilimanjaro", country: "Tanzania", continent: "africa", lat: -3.07, lng: 37.35, region: "worldwide", photo: ["kilimanjaro", 0],
      description: "Africa's highest mountain (5,895 m), a free-standing volcano climbed through five climate zones." },
    { id: "atlas", name: "Atlas Mountains", country: "Morocco", continent: "africa", lat: 31.06, lng: -7.92, region: "worldwide", photo: "atlas",
      description: "Berber villages, mule trails and Toubkal (4,167 m), the highest peak in North Africa." },
    { id: "southern-alps", name: "Southern Alps", country: "New Zealand", continent: "oceania", lat: -43.59, lng: 170.14, region: "worldwide", photo: "southern-alps",
      description: "New Zealand's alpine spine around Aoraki / Mount Cook (3,724 m), with glacier valleys and the Hooker Valley Track." },
  ];

  window.DESTINATION_DATA = { CONTINENTS, DESTINATIONS };
})();
