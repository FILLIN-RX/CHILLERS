/* CHILLERS — intro sound signature, synthesised offline (no samples).
   0.00-0.50 sub-bass woosh | 0.50 dry cinematic impact + dark reverb
   1.00-3.00 retro-futuristic synthwave pad fading out | 2.42 plunge whoosh */
(() => {
  const SR = 48000, DUR = 3.5;

  function prng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function noiseBuffer(ctx, seconds, seed) {
    const n = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    const r = prng(seed);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const w = r() * 2 - 1;
        lp += 0.08 * (w - lp);            // slight brown tilt, less harsh
        d[i] = w * 0.6 + lp * 0.8;
      }
    }
    return b;
  }

  function impulse(ctx, seconds, decay, seed) {
    const n = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    const r = prng(seed);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const env = Math.pow(1 - t, decay);
        lp += 0.24 * ((r() * 2 - 1) - lp); // dark: noise pre-lowpassed
        d[i] = lp * env * (t < 0.004 ? t / 0.004 : 1);
      }
    }
    return b;
  }

  // percussive envelope with fast attack and exponential tail
  function hit(g, t0, peak, attack, tail, curve = 3) {
    const p = g.gain;
    p.setValueAtTime(0.0001, t0);
    p.exponentialRampToValueAtTime(peak, t0 + attack);
    p.exponentialRampToValueAtTime(0.0001, t0 + attack + tail);
    return p;
  }

  function tone(ctx, dest, type, f0, f1, t0, dur, peak, curve) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    (curve || hit)(g, t0, peak, 0.006, dur);
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.2);
    return o;
  }

  function noiseShot(ctx, dest, t0, dur, peak, filterType, f0, f1, q) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx, dur + 0.1, Math.round(t0 * 1000) + 7);
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.92);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
    s.connect(f).connect(g).connect(dest);
    s.start(t0); s.stop(t0 + dur + 0.1);
  }

  async function render(sampleRate = SR) {
    const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * DUR), sampleRate);
    const master = ctx.createGain(); master.gain.value = 0.9;

    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) {
      const x = (i / 2047) * 2 - 1;
      curve[i] = Math.tanh(x * 1.7) / Math.tanh(1.7); // gentle bus limiting
    }
    shaper.curve = curve;
    master.connect(shaper).connect(ctx.destination);

    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 2.6, 2.6, 4242);
    const verbGain = ctx.createGain(); verbGain.gain.value = 0.5;
    const verbTone = ctx.createBiquadFilter();
    verbTone.type = 'lowpass'; verbTone.frequency.value = 3200;
    verb.connect(verbTone).connect(verbGain).connect(master);

    const dry = master;

    /* 1 — rising sub-bass woosh, 0.0 -> 0.5 */
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.0001, 0);
    subG.gain.exponentialRampToValueAtTime(0.95, 0.46);
    subG.gain.exponentialRampToValueAtTime(0.0001, 0.62);
    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(24, 0);
    sub.frequency.exponentialRampToValueAtTime(115, 0.5);
    const sub2 = ctx.createOscillator(); sub2.type = 'triangle';
    sub2.frequency.setValueAtTime(48, 0);
    sub2.frequency.exponentialRampToValueAtTime(230, 0.5);
    const sub2G = ctx.createGain(); sub2G.gain.value = 0.22;
    sub.connect(subG).connect(dry);
    sub2.connect(sub2G).connect(subG);
    sub.start(0); sub2.start(0); sub.stop(0.7); sub2.stop(0.7);
    noiseShot(ctx, dry, 0.0, 0.5, 0.5, 'bandpass', 220, 5200, 1.2);
    noiseShot(ctx, verb, 0.05, 0.45, 0.3, 'highpass', 400, 6000, 0.7);

    /* 2 — the hit at 0.5s: thump + transient + metal partials + dark tail */
    tone(ctx, dry, 'sine', 128, 36, 0.5, 0.55, 1.0, hit);
    tone(ctx, dry, 'triangle', 74, 30, 0.5, 0.9, 0.55, hit);
    noiseShot(ctx, dry, 0.5, 0.05, 0.85, 'highpass', 1400, 5200, 0.6);
    [186, 279, 418, 623, 905].forEach((f, i) => {
      const g = ctx.createGain();
      hit(g, 0.5 + i * 0.004, 0.13 / (i + 1), 0.004, 0.7 + i * 0.12);
      const o = ctx.createOscillator();
      o.type = i > 2 ? 'sine' : 'triangle';
      o.frequency.value = f * (1 + (i % 2 ? 0.004 : -0.003));
      o.connect(g).connect(dry); o.connect(g).connect(verb);
      o.start(0.5); o.stop(1.9);
    });
    tone(ctx, verb, 'sine', 96, 42, 0.5, 1.2, 0.5, hit);

    /* 3 — synthwave pad, 1.0 -> 3.0, fading into silence */
    const pad = ctx.createGain();
    pad.gain.setValueAtTime(0.0001, 0.9);
    pad.gain.exponentialRampToValueAtTime(0.3, 1.18);
    pad.gain.setValueAtTime(0.3, 2.3);
    pad.gain.exponentialRampToValueAtTime(0.0001, 3.34);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 7;
    lp.frequency.setValueAtTime(300, 1.0);
    lp.frequency.exponentialRampToValueAtTime(2600, 1.5);
    lp.frequency.exponentialRampToValueAtTime(420, 3.3);
    const chorus = ctx.createDelay(0.05); chorus.delayTime.value = 0.019;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.75;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.0035;
    lfo.connect(lfoG).connect(chorus.delayTime); lfo.start(1.0); lfo.stop(3.4);
    const padWet = ctx.createGain(); padWet.gain.value = 0.5;
    lp.connect(pad);
    lp.connect(chorus); chorus.connect(padWet).connect(pad);
    pad.connect(dry);
    const padVerb = ctx.createGain(); padVerb.gain.value = 0.34;
    pad.connect(padVerb).connect(verb);

    // Am(add9) voicing: A2 E3 A3 C4 E4 B4
    [110, 164.81, 220, 261.63, 329.63, 493.88].forEach((f, i) => {
      [-7, 0, 7].forEach((cents) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f * Math.pow(2, cents / 1200);
        const g = ctx.createGain();
        g.gain.value = (i === 0 ? 0.16 : 0.1) / (1 + Math.abs(cents) / 9);
        o.connect(g).connect(lp);
        o.start(1.0); o.stop(3.4);
      });
      const sub = ctx.createOscillator();
      sub.type = 'sine'; sub.frequency.value = f / 2;
      const g = ctx.createGain(); g.gain.value = 0.05;
      sub.connect(g).connect(lp);
      sub.start(1.0); sub.stop(3.4);
    });

    /* 4 — camera plunge whoosh, 2.42 -> 3.1 */
    noiseShot(ctx, dry, 2.42, 0.62, 0.42, 'bandpass', 5200, 260, 1.6);
    tone(ctx, dry, 'sine', 92, 28, 2.44, 0.8, 0.55, (g, t0, peak, at, tail) => {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + tail);
    });
    noiseShot(ctx, verb, 2.5, 0.5, 0.25, 'lowpass', 1800, 220, 0.9);

    const buf = await ctx.startRendering();
    return buf;
  }

  function toWav(buf) {
    const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate;
    const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); out.setUint32(16, 16, true);
    out.setUint16(20, 1, true); out.setUint16(22, ch, true);
    out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true);
    out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    str(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const data = [];
    for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let peak = 0;
    for (let c = 0; c < ch; c++) for (let i = 0; i < n; i += 7) peak = Math.max(peak, Math.abs(data[c][i]));
    const norm = peak > 0 ? Math.min(1, 0.85 / peak) : 1; // headroom for AAC
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < ch; c++) {
        const v = Math.max(-1, Math.min(1, data[c][i] * norm));
        out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
      }
    }
    return new Uint8Array(out.buffer);
  }

  // live playback for the browser preview
  let cached = null;
  async function play() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ac = new AC();
    if (!cached) cached = toWav(await render(ac.sampleRate));
    const ab = await ac.decodeAudioData(cached.slice(0).buffer);
    const s = ac.createBufferSource();
    s.buffer = ab; s.connect(ac.destination); s.start(0);
    return s;
  }

  window.IntroAudio = { render, toWav, play, duration: DUR };
})();
