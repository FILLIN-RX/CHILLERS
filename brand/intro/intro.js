/* CHILLERS — cinematic brand intro renderer.
   Every frame is a pure function of t, so the same code drives live playback
   and offline frame-by-frame rendering at any resolution. */
(() => {
  const DW = 1920, DH = 1080, DURATION = 3.5;
  const CYAN = [57, 230, 255], MAG = [244, 42, 124], VIOLET = [124, 58, 237];

  // beats: logo burst -> impact -> neon hold -> disintegration -> plunge -> black
  const B = {
    burst: 0.06, impact: 0.5, hold: 1.08,
    breakStart: 1.02, breakEnd: 2.42, plungeEnd: 3.14, end: DURATION,
  };

  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const inv = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (u) => u * u * (3 - 2 * u);
  const ease = {
    outCubic: (u) => 1 - Math.pow(1 - u, 3),
    inCubic: (u) => u * u * u,
    outExpo: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -9 * u)),
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  // deterministic noise: same value for the same (index, salt) on every render
  function rnd(n, salt = 0) {
    const x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  let canvas, ctx, S = 1, W = DW, H = DH;
  let field, fctx, arc, actx, bloomA;
  let logo, tintC, tintM, silh, edge, streak, blob, smokeC, smokeM, smokeV, grainPat, vignette;
  let strips = [], ready = false, lastT = 0;

  const LOGO_H = 640; // design units
  const CX = DW / 2, CY = DH / 2 - 6;
  const AN = 640; // analysis grid edge

  /* ---------------------------------------------------------------- assets */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function tintImage(img, color) {
    const c = makeCanvas(img.width, img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = rgba(color, 1);
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // rim-only version of the mark: that is what the neon arc travels along
  function buildEdge(src, size) {
    const c = makeCanvas(size, size), x = c.getContext('2d');
    x.drawImage(src, 0, 0, size, size);
    const inset = size * 0.05;
    x.globalCompositeOperation = 'destination-out';
    x.drawImage(src, inset, inset, size - inset * 2, size - inset * 2);
    return c;
  }

  function makeStreak() {
    const c = makeCanvas(64, 512), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    const h = x.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, 'rgba(0,0,0,1)');
    h.addColorStop(0.5, 'rgba(0,0,0,0)');
    h.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 512);
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = h; x.fillRect(0, 0, 64, 512);
    return c;
  }

  function makeBlob() {
    const c = makeCanvas(256, 256), x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return c;
  }

  function buildStrips() {
    const a = makeCanvas(AN, AN), x = a.getContext('2d');
    x.drawImage(logo, 0, 0, AN, AN);
    const d = x.getImageData(0, 0, AN, AN).data;
    const step = 4, k = LOGO_H / AN, out = [];
    for (let px = 0; px < AN; px += step) {
      let sum = 0, r = 0, g = 0, b = 0, top = -1, bot = -1;
      for (let c = px; c < px + step; c++) {
        for (let py = 0; py < AN; py++) {
          const i = (py * AN + c) * 4, al = d[i + 3];
          if (al < 26) continue;
          sum += al; r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al;
          if (top < 0) top = py;
          bot = py;
        }
      }
      if (sum < 900) continue;
      const seed = out.length;
      out.push({
        xRel: (px + step / 2 - AN / 2) * k,
        top: (top - AN / 2) * k,
        bot: (bot - AN / 2) * k,
        col: [r / sum, g / sum, b / sum],
        srcX: (px / AN) * logo.width,
        srcW: (step / AN) * logo.width,
        wRel: step * k, // design-unit width of this column
        dens: clamp(sum / (step * AN * 190), 0.12, 1),
        delay: 0.2 * rnd(seed, 3),
        dur: 1.5 + 0.62 * rnd(seed, 7),
        curl: (rnd(seed, 11) - 0.5) * 2,
        ribbon: rnd(seed, 13) > 0.6,
        hot: rnd(seed, 17) > 0.82,
      });
    }
    strips = out;
  }

  /* ------------------------------------------------------------ compositing */
  function glow(src, down, blur, alpha) {
    const w = Math.max(1, Math.round(src.width / down)), h = Math.max(1, Math.round(src.height / down));
    if (bloomA.width !== w || bloomA.height !== h) { bloomA.width = w; bloomA.height = h; }
    bloomA.getContext('2d').drawImage(src, 0, 0, w, h);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = `blur(${blur}px)`;
    ctx.globalAlpha = alpha;
    ctx.drawImage(bloomA, 0, 0, src.width, src.height);
    ctx.restore();
  }

  // radial zoom blur: energy is split between the base pass and its ghosts
  function zoomBlur(src, amount, samples, base) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const cx = src.width / 2, cy = src.height / 2, gw = (1 - base) / samples;
    for (let i = 0; i < samples; i++) {
      const u = (i + 1) / samples, s = 1 + amount * u * u;
      ctx.globalAlpha = gw;
      ctx.setTransform(s, 0, 0, s, cx * (1 - s), cy * (1 - s));
      ctx.drawImage(src, 0, 0);
    }
    ctx.restore();
  }

  /* ----------------------------------------------------------------- layers */
  function drawSmoke(t) {
    const a = inv(t, 0.1, 0.9) * (1 - 0.7 * inv(t, B.breakEnd + 0.4, B.end));
    if (a <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const ph = rnd(i, 21) * 6.283, sp = 0.25 + rnd(i, 23) * 0.5;
      const r = 260 + rnd(i, 29) * 520;
      const x = CX + Math.cos(ph + t * sp) * (420 + rnd(i, 31) * 620);
      const y = CY + Math.sin(ph * 1.7 + t * sp * 0.8) * (150 + rnd(i, 37) * 300);
      const sprite = i % 3 === 0 ? smokeM : i % 3 === 1 ? smokeC : smokeV;
      ctx.globalAlpha = 0.028 * a * (0.4 + rnd(i, 41) * 0.6);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(t * sp * 0.3 + ph); ctx.scale(r / 256, r / 210);
      ctx.drawImage(sprite, -128, -128);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCore(t) {
    const q = inv(t, B.burst, B.impact);
    if (q <= 0) return;
    const settle = inv(t, B.impact, B.impact + 0.22);
    const sc = (lerp(0.34, 1, ease.outExpo(q)) + 0.035 * Math.sin(settle * Math.PI) * (1 - settle))
      * (1 + 0.012 * Math.sin(inv(t, B.impact, B.end) * 7.5));
    const fade = 1 - smooth(inv(t, B.breakStart, B.breakStart + 0.46));
    if (fade <= 0.002) return;

    const flick = t < B.impact ? 0.55 + 0.45 * rnd(Math.round(t * 60), 51) : 1;
    const bright = lerp(3.4, 1, ease.outCubic(q)) * flick;
    const size = LOGO_H * sc, half = size / 2;

    ctx.save();
    ctx.translate(CX, CY);
    ctx.globalCompositeOperation = 'lighter';

    // chromatic split, widest on the hit
    const ab = lerp(15, 0, ease.outCubic(inv(t, B.impact, B.impact + 0.36))) + 2.5;
    ctx.globalAlpha = 0.42 * fade * clamp(bright * 0.4, 0, 1);
    ctx.drawImage(tintC, -half - ab, -half, size, size);
    ctx.drawImage(tintM, -half + ab, -half, size, size);

    ctx.globalAlpha = fade * clamp(0.35 + 0.65 * q, 0, 1);
    ctx.drawImage(logo, -half, -half, size, size);

    // over-bright core at ignition
    ctx.globalAlpha = fade * clamp((bright - 1) * 0.5, 0, 0.9);
    ctx.drawImage(silh, -half, -half, size, size);

    // neon arc racing around the rim (Saber-style)
    const arc1 = inv(t, B.impact + 0.04, B.breakStart + 0.3);
    if (arc1 > 0 && arc1 < 1.02) {
      const w = arc.width;
      actx.setTransform(1, 0, 0, 1, 0, 0);
      actx.globalCompositeOperation = 'source-over';
      actx.clearRect(0, 0, w, w);
      actx.drawImage(edge, 0, 0, w, w);
      actx.globalCompositeOperation = 'destination-in';
      const off = (arc1 * 1.9 - 0.45) * w, band = w * 0.17;
      const g = actx.createLinearGradient(off - band, 0, off + band, w * 0.6);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.45, 'rgba(255,255,255,1)');
      g.addColorStop(0.6, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      actx.fillStyle = g; actx.fillRect(0, 0, w, w);
      actx.globalCompositeOperation = 'source-atop';
      actx.fillStyle = 'rgba(226,250,255,1)'; actx.fillRect(0, 0, w, w);
      ctx.globalAlpha = fade * 0.85 * Math.sin(clamp(arc1) * Math.PI);
      ctx.drawImage(arc, -half, -half, size, size);
    }
    ctx.restore();
  }

  function drawBeams(t) {
    if (t < B.breakStart - 0.05) return;
    const plunge = ease.inCubic(inv(t, B.breakEnd, B.plungeEnd));

    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, field.width, field.height);
    fctx.save();
    fctx.scale(S, S);
    fctx.translate(CX, CY);
    fctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < strips.length; i++) {
      const s = strips[i];
      const p = inv(t - B.breakStart - s.delay, 0, s.dur);
      if (p <= 0) continue;
      const f = 1 / (1 - 0.92 * Math.min(p, 0.985));
      const yTop = s.top * f, yBot = s.bot * f;
      const h = Math.max(3, yBot - yTop), mid = (yTop + yBot) / 2;
      const w = Math.max(1.2, s.wRel * f * 1.15);
      const env = smooth(clamp(p / 0.16)) * (1 - smooth(clamp((p - 0.7) / 0.3)));
      const a = clamp(Math.pow(env * lerp(1, 0.55, p) * (0.35 + 0.65 * s.dens), 1.25) * (s.hot ? 1.3 : 1), 0, 1);
      if (a < 0.012) continue;
      const x = s.xRel * f + s.curl * 22 * p * p;
      const slice = s.hot ? logo : s.col[2] >= s.col[0] ? tintC : tintM;

      // chromatic ribbons sheared off the beam
      fctx.globalAlpha = a * 0.16;
      fctx.drawImage(tintC, s.srcX, 0, s.srcW, logo.height, x - w * 2.4, yTop, w * 1.5, h);
      fctx.drawImage(tintM, s.srcX, 0, s.srcW, logo.height, x + w * 0.9, yBot - h * 0.9, w * 1.5, h);
      // halo, then the projected column
      fctx.globalAlpha = a * 0.13;
      fctx.drawImage(logo, s.srcX, 0, s.srcW, logo.height, x - w * 1.5, yTop - h * 0.03, w * 3, h * 1.06);
      fctx.globalAlpha = a * 0.78;
      fctx.drawImage(slice, s.srcX, 0, s.srcW, logo.height, x - w / 2, yTop, w, h);
      // laser tail firing past the camera
      fctx.globalAlpha = a * (s.hot ? 0.24 : 0.13);
      fctx.drawImage(streak, x - w * 0.8, mid - h * (0.5 + 1.3 * p), w * 1.6, h * (1 + 2.6 * p));
      if (s.ribbon && p > 0.12) {
        fctx.globalAlpha = a * 0.08;
        const yy = mid + Math.sin(p * 7 + i) * h * 0.3;
        fctx.drawImage(streak, x - w * 5, yy - h * 0.02, w * 10, h * 0.04);
      }
    }
    fctx.restore();

    const base = lerp(1, 0.6, plunge);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = base;
    ctx.drawImage(field, 0, 0);
    ctx.restore();
    glow(field, 7, 4 * S, 0.16 + 0.1 * plunge);
    if (plunge > 0.1) zoomBlur(field, 0.06 + 0.9 * plunge, 6, base);
  }

  function drawFlare(t) {
    if (t < B.impact - 0.06) return;
    const decay = Math.exp(-inv(t, B.impact, B.impact + 0.9) * 3.4);
    const life = 1 - smooth(inv(t, B.breakStart + 0.4, B.breakEnd));
    const a = (0.14 + 0.46 * decay) * life;
    if (a <= 0.004) return;

    ctx.save();
    ctx.translate(CX, CY);
    ctx.globalCompositeOperation = 'lighter';

    // anamorphic horizontal streak
    ctx.globalAlpha = a;
    ctx.save();
    ctx.scale(1, 0.026 + 0.02 * decay);
    ctx.drawImage(streak, -DW, -DH / 2, DW * 2, DH);
    ctx.restore();
    ctx.globalAlpha = a * 0.5;
    ctx.save();
    ctx.scale(1, 0.09);
    ctx.drawImage(streak, -DW * 0.7, -DH / 2, DW * 1.4, DH);
    ctx.restore();

    // optical core + 6-point spikes
    ctx.globalAlpha = a * 0.75;
    ctx.drawImage(blob, -240, -240, 480, 480);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * (Math.PI / 3) + 0.35 + decay * 0.4);
      ctx.globalAlpha = a * 0.28;
      ctx.drawImage(streak, -9, -420, 18, 840);
      ctx.restore();
    }
    // ghost discs pushed off-axis
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = a * 0.07 / i;
      const d = i * 200 * (1 + decay * 0.4);
      ctx.drawImage(blob, d - 60, d * 0.26 - 60, 120 + i * 34, 120 + i * 34);
    }
    // the hit itself: very short, very bright
    const flash = Math.max(0, 1 - inv(t, B.impact - 0.02, B.impact + 0.1));
    if (flash > 0) {
      ctx.globalAlpha = flash * 0.8;
      ctx.fillStyle = '#e6f9ff';
      ctx.fillRect(-CX, -CY, DW, DH);
    }
    ctx.restore();
  }

  function drawFinish(t) {
    const k = inv(t, B.breakEnd, B.plungeEnd);
    if (k > 0) {
      ctx.save();
      ctx.translate(CX, CY);
      ctx.globalCompositeOperation = 'lighter';
      const r = DW * 0.34;
      const g = ctx.createRadialGradient(0, 0, r * 0.02, 0, 0, r);
      g.addColorStop(0, rgba([255, 255, 255], 0.22 * Math.sin(k * Math.PI)));
      g.addColorStop(0.25, rgba(CYAN, 0.09 * Math.sin(k * Math.PI)));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
    const out = smooth(inv(t, B.plungeEnd - 0.05, B.end - 0.05));
    if (out > 0) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(5,5,7,${out})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  function drawGrade() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!vignette || vignette.width !== W) {
      vignette = makeCanvas(W, H);
      const vx = vignette.getContext('2d');
      const g = vx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.76);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
      g.addColorStop(1, 'rgba(0,0,0,0.85)');
      vx.fillStyle = g; vx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(vignette, 0, 0);
    if (grainPat) {
      const fr = Math.round(lastT * 60);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.045;
      const ox = rnd(fr, 61) * 300, oy = rnd(fr, 67) * 300;
      ctx.translate(-ox, -oy);
      ctx.fillStyle = grainPat;
      ctx.fillRect(0, 0, W + 300, H + 300);
    }
    ctx.restore();
  }

  /* ----------------------------------------------------------------- render */
  function render(t) {
    if (!ready) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // 3-frame camera shake on the reveal, then a decaying ring-out
    const fr = Math.round(t * 60);
    const hit = t >= B.impact && t < B.impact + 0.05;
    const ring = hit ? 1 : Math.max(0, 1 - inv(t, B.impact + 0.05, B.impact + 0.3));
    const amp = (hit ? 30 : 0) + ring * 14;
    const sx = amp ? (rnd(fr, 71) - 0.5) * amp : 0;
    const sy = amp ? (rnd(fr, 73) - 0.5) * amp : 0;
    const rot = amp ? (rnd(fr, 79) - 0.5) * 0.01 * (amp / 30) : 0;
    const push = 1 + 0.07 * ease.inCubic(inv(t, B.breakEnd, B.plungeEnd));

    ctx.setTransform(S * push, 0, 0, S * push, sx + W / 2 - CX * S * push, sy + H / 2 - CY * S * push);
    if (rot) { ctx.translate(CX, CY); ctx.rotate(rot); ctx.translate(-CX, -CY); }

    drawSmoke(t);
    drawCore(t);
    drawBeams(t);
    drawFlare(t);
    drawFinish(t);
    drawGrade();
  }

  function resize(w, h) {
    W = Math.round(w); H = Math.round(h); S = H / DH;
    canvas.width = W; canvas.height = H;
    field.width = W; field.height = H;
    vignette = null;
    render(lastT);
  }

  async function init(el) {
    canvas = el; ctx = canvas.getContext('2d', { alpha: false });
    field = makeCanvas(1, 1); fctx = field.getContext('2d');
    arc = makeCanvas(1024, 1024); actx = arc.getContext('2d');
    bloomA = makeCanvas(1, 1);

    const load = (src) => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
    });
    logo = await load('assets/chillers-logo-2k.png');
    tintC = tintImage(logo, CYAN);
    tintM = tintImage(logo, MAG);
    silh = tintImage(logo, [255, 255, 255]);
    edge = buildEdge(silh, 1024);
    streak = makeStreak();
    blob = makeBlob();
    smokeC = tintImage(blob, CYAN);
    smokeM = tintImage(blob, MAG);
    smokeV = tintImage(blob, VIOLET);

    const gn = makeCanvas(512, 512), gx = gn.getContext('2d');
    const id = gx.createImageData(512, 512);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 120 + Math.floor(rnd(i / 4, 91) * 70 - 35);
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
    }
    gx.putImageData(id, 0, 0);
    grainPat = ctx.createPattern(gn, 'repeat');

    buildStrips();
    ready = true;
    resize(canvas.clientWidth, canvas.clientHeight);
  }

  window.Intro = {
    init, resize,
    seek(t) { lastT = clamp(t, 0, DURATION); render(lastT); },
    duration: DURATION,
    get ready() { return ready; },
    get strips() { return strips.length; },
  };
})();
