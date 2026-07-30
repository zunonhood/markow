/*!
 * tamayura engine — appearance = f(id)
 * -------------------------------------------------------------
 * A pure, deterministic generator for a billion digital lives.
 * The same id always yields the same creature, on any device,
 * in any runtime. No storage, no randomness, no network.
 *
 * Works both as a browser global (window.tamayura) and as a
 * CommonJS module (const tamayura = require('./tamayura.js')).
 *
 * Public API:
 *   tamayura.SUPPLY            -> 1_000_000_000
 *   tamayura.generate(id)      -> trait object (light)
 *   tamayura.pixels(id)        -> N×N array of color|null (heavier)
 *   tamayura.toSVG(id, scale?) -> string (standalone <svg>)
 *   tamayura.toASCII(id)       -> string (monospace portrait)
 *   tamayura.rarityOf(id)      -> "COMMON" | ... | "MYTHIC"
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.tamayura = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var SUPPLY = 1000000000;
  var N = 18;                // portrait grid size
  var INK = "#1d1b17";       // outline color, matches the brand ink

  var SPECIES = ["Yura","Tama","Poyo","Momo","Kuro","Shiro","Pip","Fuwa","Nimu","Riri","Bebi","Gogo"];
  var TEMPER  = ["sunny","sleepy","aloof","clingy","gloomy","mischievous","dopey","tsundere","gentle","jittery"];
  var EYES    = ["round","squint","star","heterochromia","teary","sanpaku","closed","heart"];
  var PALETTES = [
    { name: "mint",     body: "#6fcf97" }, { name: "sakura",   body: "#f2a6c2" },
    { name: "sky",      body: "#6fa8dc" }, { name: "cream",    body: "#f5d76e" },
    { name: "lavender", body: "#b39ddb" }, { name: "coral",    body: "#ff8a65" },
    { name: "charcoal", body: "#7f8c8d" }, { name: "snow",     body: "#e8e8e8" }
  ];

  // ---- deterministic PRNG (mulberry32) --------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedFor(id, salt) {
    // spread the id across the 32-bit space so neighbors look unrelated
    return (((id * 2654435761) % 4294967296) + (salt || 0)) | 0;
  }

  function validId(id) {
    id = Math.floor(Number(id));
    if (!isFinite(id) || id < 1) id = 1;
    if (id > SUPPLY) id = SUPPLY;
    return id;
  }

  function isPalindrome(id) {
    var s = String(id);
    return s.length > 2 && s === s.split("").reverse().join("");
  }

  // ---- rarity ---------------------------------------------------------
  function classify(id, rng) {
    if (id === 1 || id === 777 || id === SUPPLY || isPalindrome(id)) {
      return { tier: "MYTHIC", lifespanDays: Infinity };
    }
    var roll = rng();
    if (roll > 0.9995) return { tier: "LEGENDARY", lifespanDays: 11000 };
    if (roll > 0.985)  return { tier: "RARE",      lifespanDays: 8000 };
    if (roll > 0.925)  return { tier: "UNCOMMON",  lifespanDays: 4200 };
    return { tier: "COMMON", lifespanDays: 1800 };
  }
  function rarityOf(id) {
    id = validId(id);
    return classify(id, mulberry32(seedFor(id, 12345))).tier;
  }

  // ---- traits ---------------------------------------------------------
  function generate(id) {
    id = validId(id);
    var rng = mulberry32(seedFor(id, 12345));
    var pal = PALETTES[Math.floor(rng() * PALETTES.length)];
    var species = SPECIES[Math.floor(rng() * SPECIES.length)];
    var temper = TEMPER[Math.floor(rng() * TEMPER.length)];
    var eyes = EYES[Math.floor(rng() * EYES.length)];
    var cls = classify(id, rng);

    var bodyColor = pal.body, colorName = pal.name, glow = false;
    if (cls.tier === "LEGENDARY") { bodyColor = "#d4af37"; colorName = "golden"; glow = true; }
    if (cls.tier === "MYTHIC")    { bodyColor = "#111111"; colorName = "void";   glow = true; }

    return {
      id: id,
      name: species + "-" + String(id).slice(-4).padStart(4, "0"),
      species: species,
      rarity: cls.tier,
      lifespanDays: cls.lifespanDays,
      palette: colorName,
      bodyColor: bodyColor,
      eyes: eyes,
      temperament: temper,
      glow: glow,
      legendaryId: (id === 1 || id === 777 || id === SUPPLY || isPalindrome(id))
    };
  }

  // ---- pixels (baked N×N portrait) ------------------------------------
  function pixels(id) {
    id = validId(id);
    var t = generate(id);
    var rng = mulberry32(seedFor(id, 99));
    var half = N / 2, margin = 3;
    var grid = [];
    var y, x;
    for (y = 0; y < N; y++) { grid[y] = []; for (x = 0; x < N; x++) grid[y][x] = 0; }

    // symmetric blobby body
    for (y = margin; y < N - margin; y++) {
      for (x = margin; x < half; x++) {
        var dx = (half - x) / half, dy = Math.abs(y - N / 2) / half;
        var p = 0.85 - dy * 0.7 + dx * 0.15;
        if (rng() < p) { grid[y][x] = 1; grid[y][N - 1 - x] = 1; }
      }
    }

    // fill -> colors
    var px = [];
    for (y = 0; y < N; y++) { px[y] = []; for (x = 0; x < N; x++) px[y][x] = grid[y][x] ? t.bodyColor : null; }

    // outline
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      if (!grid[y][x]) continue;
      var edge = (y === 0 || x === 0 || y === N - 1 || x === N - 1) ||
        !grid[y - 1][x] || !grid[y + 1][x] || !grid[y][x - 1] || !grid[y][x + 1];
      if (edge) px[y][x] = INK;
    }

    // eyes
    var eyeY = Math.floor(N * 0.42);
    var e1 = Math.floor(N * 0.34), e2 = N - 1 - e1;
    function set(xx, yy, c) { if (yy >= 0 && yy < N && xx >= 0 && xx < N) px[yy][xx] = c; }
    if (t.eyes === "squint" || t.eyes === "closed") {
      set(e1 - 1, eyeY, INK); set(e1, eyeY, INK); set(e1 + 1, eyeY, INK);
      set(e2 - 1, eyeY, INK); set(e2, eyeY, INK); set(e2 + 1, eyeY, INK);
    } else {
      set(e1, eyeY, INK); set(e1 + 1, eyeY, INK); set(e1, eyeY + 1, INK); set(e1 + 1, eyeY + 1, INK);
      set(e2, eyeY, INK); set(e2 + 1, eyeY, INK); set(e2, eyeY + 1, INK); set(e2 + 1, eyeY + 1, INK);
      if (t.eyes === "heterochromia") { set(e2, eyeY, "#e53935"); set(e2 + 1, eyeY, "#e53935"); }
    }
    // blush for the rarer ones
    if (t.rarity === "RARE" || t.rarity === "LEGENDARY" || t.rarity === "MYTHIC") {
      set(e1 - 1, eyeY + 2, "#ff9bb3"); set(e2 + 1, eyeY + 2, "#ff9bb3");
    }
    // mouth
    set(half - 1, eyeY + 3, INK); set(half, eyeY + 3, INK);

    return px;
  }

  // ---- renderers ------------------------------------------------------
  function toSVG(id, scale) {
    scale = scale || 12;
    var px = pixels(id);
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + N * scale +
      '" height="' + N * scale + '" viewBox="0 0 ' + N + ' ' + N +
      '" shape-rendering="crispEdges">';
    s += '<rect width="' + N + '" height="' + N + '" fill="#fbf8f1"/>';
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var c = px[y][x];
      if (c) s += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + c + '"/>';
    }
    return s + "</svg>";
  }

  function toASCII(id) {
    var px = pixels(id);
    var out = [];
    for (var y = 0; y < N; y++) {
      var row = "";
      for (var x = 0; x < N; x++) row += px[y][x] ? (px[y][x] === INK ? "#" : "o") : " ";
      out.push(row);
    }
    return out.join("\n");
  }

  return {
    SUPPLY: SUPPLY,
    N: N,
    generate: generate,
    pixels: pixels,
    toSVG: toSVG,
    toASCII: toASCII,
    rarityOf: rarityOf
  };
});
