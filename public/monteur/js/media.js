// Lecture MP4/MOV (mp4box), décodage et encodage (WebCodecs), traitement audio, multiplexage MP4.
import { createFile, MP4BoxBuffer, DataStream, Endianness } from "../vendor/mp4box/mp4box.all.mjs";
import { Muxer, ArrayBufferTarget } from "../vendor/mp4-muxer.mjs";
import { drawOverlays, W, H } from "./overlays.js";
import { srcTime, zoomAt } from "./planner.js";

export class UserError extends Error {}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- Compatibilité du navigateur ----------
export async function checkSupport(test = false, forceFallback = false) {
  const r = { ok: true, items: [] };
  const add = (ok, label, fix) => { r.items.push({ ok, label, fix }); if (!ok) r.ok = false; };
  add(window.isSecureContext, "Page sécurisée (https)", "Ouvrez le site par son adresse https.");
  add(typeof VideoDecoder === "function" && typeof VideoEncoder === "function", "Décodage et encodage vidéo (WebCodecs)", "Utilisez Google Chrome ou Microsoft Edge à jour, sur ordinateur.");
  let vcodec = null;
  if (typeof VideoEncoder === "function") {
    const list = test ? ["vp09.00.40.08"] : ["avc1.640028", "avc1.4d0028", "avc1.42002a"];
    for (const c of list) { try { const s = await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: 12e6, framerate: 30 }); if (s.supported) { vcodec = c; break; } } catch (e) {} }
  }
  add(!!vcodec, "Encodage H.264 en 1080×1920", "Mettez à jour Chrome ou Edge. Sur Linux, installez Google Chrome (pas Chromium).");
  let acodec = null;
  if (typeof AudioEncoder === "function") {
    for (const c of (test ? ["opus"] : ["mp4a.40.2"])) { try { const s = await AudioEncoder.isConfigSupported({ codec: c, sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 }); if (s.supported) { acodec = c; break; } } catch (e) {} }
  }
  if (forceFallback) acodec = null;
  r.items.push({ ok: true, label: acodec ? "Encodage audio AAC intégré" : "Encodage audio AAC par module de secours (plus lent)" });
  r.vcodec = vcodec; r.acodec = acodec;
  const mem = navigator.deviceMemory; if (mem && mem < 4) r.items.push({ ok: true, warn: true, label: `Mémoire limitée (${mem} Go) : préférez des vidéos de moins de 90 s.` });
  return r;
}

// ---------- Analyse du fichier ----------
function descriptionOf(trak) {
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
    if (box) { const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN); box.write(stream); return new Uint8Array(stream.buffer, 8); }
  }
  return undefined;
}
function rotationOf(m) {
  if (!m) return 0;
  const a = m[0] / 65536, b = m[1] / 65536;
  let deg = Math.round(Math.atan2(b, a) * 180 / Math.PI);
  deg = ((deg % 360) + 360) % 360;
  return [0, 90, 180, 270].reduce((p, c) => Math.abs(c - deg) < Math.abs(p - deg) ? c : p, 0);
}

export function demux(buffer) {
  return new Promise((resolve, reject) => {
    const f = createFile();
    let info = null; const samples = [];
    f.onError = e => reject(new UserError("Fichier vidéo illisible : " + e));
    f.onReady = i => {
      info = i;
      const vt = i.videoTracks && i.videoTracks[0];
      if (!vt) { reject(new UserError("Aucune piste vidéo trouvée dans ce fichier.")); return; }
      f.setExtractionOptions(vt.id, null, { nbSamples: 1e9 });
      f.start();
    };
    f.onSamples = (id, user, s) => { for (const x of s) samples.push(x); };
    try {
      const mb = MP4BoxBuffer.fromArrayBuffer(buffer, 0);
      f.appendBuffer(mb); f.flush();
    } catch (e) { reject(new UserError("Format non pris en charge. Exportez la vidéo en MP4 ou MOV.")); return; }
    if (!info) { reject(new UserError("Ce fichier n'est pas un MP4/MOV valide (filmez avec l'appareil photo du téléphone, ou exportez en MP4).")); return; }
    const vt = info.videoTracks[0];
    const trak = f.getTrackById(vt.id);
    const rot = rotationOf(vt.matrix);
    let shift = 0;
    try { const el = trak.edts && trak.edts.elst && trak.edts.elst.entries; if (el && el.length) { const first = el.find(e => e.media_time >= 0); if (first) shift = first.media_time / vt.timescale; } } catch (e) {}
    const cw = vt.video ? vt.video.width : vt.track_width, ch = vt.video ? vt.video.height : vt.track_height;
    const dw = rot % 180 ? ch : cw, dh = rot % 180 ? cw : ch;
    const dur = vt.duration / vt.timescale || info.duration / info.timescale;
    resolve({
      codec: vt.codec, description: descriptionOf(trak), codedWidth: cw, codedHeight: ch, rotation: rot,
      displayWidth: dw, displayHeight: dh, timescale: vt.timescale, duration: dur, shift,
      fps: vt.nb_samples / dur, samples, hasAudio: (info.audioTracks || []).length > 0
    });
  });
}

// ---------- Boucle de décodage avec contre-pression ----------
async function decodeAll(meta, onFrame, onProgress, opts = {}) {
  const queue = []; let error = null;
  const dec = new VideoDecoder({ output: f => queue.push(f), error: e => { error = e; } });
  const cfg = { codec: meta.codec, codedWidth: meta.codedWidth, codedHeight: meta.codedHeight, description: meta.description, hardwareAcceleration: "no-preference" };
  const sup = await VideoDecoder.isConfigSupported(cfg).catch(() => ({ supported: false }));
  if (!sup.supported) {
    if (/^hvc1|^hev1/.test(meta.codec)) throw new UserError("Vidéo en HEVC non lisible sur cet ordinateur. Sur iPhone : Réglages › Appareil photo › Formats › « Le plus compatible », puis refilmez (ou exportez en H.264).");
    throw new UserError(`Codec vidéo non pris en charge (${meta.codec}). Exportez la vidéo en MP4 H.264.`);
  }
  dec.configure(cfg);
  const ts = meta.timescale; const S = meta.samples; const until = opts.until ?? Infinity;
  let k = 0;
  const drain = async () => { while (queue.length) { const f = queue.shift(); try { await onFrame(f); } finally { f.close(); } } };
  while (k < S.length) {
    if (error) throw new UserError("Erreur de décodage vidéo : " + error.message);
    if (dec.decodeQueueSize > 6 || queue.length > 3) { await drain(); if (dec.decodeQueueSize > 6) await sleep(2); continue; }
    const s = S[k++];
    if ((s.cts / ts - meta.shift) > until + 1 && s.is_sync) break;
    dec.decode(new EncodedVideoChunk({ type: s.is_sync ? "key" : "delta", timestamp: Math.round((s.cts / ts - meta.shift) * 1e6), duration: Math.round(s.duration / ts * 1e6), data: s.data }));
    if (onProgress && k % 15 === 0) onProgress(k / S.length);
    if (k % 30 === 0) await drain();
  }
  await dec.flush().catch(e => { error = error || e; });
  await drain();
  dec.close();
  if (error) throw new UserError("Erreur de décodage vidéo : " + error.message);
}

// Dessine une image source (VideoFrame ou vidéo) dans l'espace d'affichage, avec rotation
function drawSource(ctx, src, meta, sx, sy, sw, sh, outW, outH) {
  const sc = outW / sw;
  ctx.save();
  ctx.transform(sc, 0, 0, outH / sh, -sx * sc, -sy * (outH / sh));
  if (src instanceof HTMLVideoElement || !meta.rotation) ctx.drawImage(src, 0, 0, meta.displayWidth, meta.displayHeight);
  else {
    const cw = meta.codedWidth, ch = meta.codedHeight;
    ctx.translate(meta.displayWidth / 2, meta.displayHeight / 2); ctx.rotate(meta.rotation * Math.PI / 180);
    ctx.drawImage(src, -cw / 2, -ch / 2, cw, ch);
  }
  ctx.restore();
}

// ---------- Suivi du visage (≈4 images/s) ----------
export async function trackFaces(meta, detect, onProgress) {
  const pts = []; let nextT = 0;
  const cv = document.createElement("canvas"); const scale = 360 / meta.displayWidth; cv.width = 360; cv.height = Math.round(meta.displayHeight * scale);
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  await decodeAll(meta, async f => {
    const t = f.timestamp / 1e6; if (t < nextT) return; nextT = t + 0.25;
    drawSource(ctx, f, meta, 0, 0, meta.displayWidth, meta.displayHeight, cv.width, cv.height);
    const d = await detect(cv);
    if (d) pts.push({ t, x: d.x / scale, y: d.y / scale, h: d.h / scale });
  }, onProgress);
  return smoothTrack(pts, meta);
}
export function smoothTrack(pts, meta) {
  const cx = meta.displayWidth / 2, cy = meta.displayHeight * 0.4;
  if (!pts.length) return { at: () => ({ x: cx, y: cy }), faceH: meta.displayHeight * 0.18, found: 0 };
  const hs = pts.map(p => p.h).sort((a, b) => a - b); const med = hs[Math.floor(hs.length / 2)];
  const good = pts.filter(p => p.h > med * 0.55 && p.h < med * 1.7);
  const step = 0.1, N = Math.ceil(meta.duration / step) + 1; const xs = new Float32Array(N), ys = new Float32Array(N);
  const interp = (arr, key, t) => { if (t <= arr[0].t) return arr[0][key]; if (t >= arr[arr.length - 1].t) return arr[arr.length - 1][key];
    let lo = 0, hi = arr.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m].t <= t) lo = m; else hi = m; }
    const a = arr[lo], b = arr[hi], u = (t - a.t) / (b.t - a.t || 1); return a[key] + (b[key] - a[key]) * u; };
  const src = good.length ? good : pts;
  for (let i = 0; i < N; i++) { xs[i] = interp(src, "x", i * step); ys[i] = interp(src, "y", i * step); }
  const blur = (a, sig) => { const r = Math.ceil(sig * 3), k = []; let sum = 0; for (let j = -r; j <= r; j++) { const v = Math.exp(-j * j / (2 * sig * sig)); k.push(v); sum += v; }
    const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) { let s = 0; for (let j = -r; j <= r; j++) s += a[Math.min(a.length - 1, Math.max(0, i + j))] * k[j + r]; o[i] = s / sum; } return o; };
  const bx = blur(xs, 2.5), by = blur(ys, 2.5);
  return { at: t => { const i = Math.min(N - 1, Math.max(0, Math.round(t / step))); return { x: bx[i], y: by[i] }; }, faceH: med, found: pts.length };
}

// ---------- Recadrage ----------
export function zoomRange(meta, face) {
  // taille du visage visée : 22 % (plan large) et 28 % (plan serré) de la hauteur
  const rel = face.faceH / meta.displayHeight;
  const wide = Math.min(2.2, Math.max(1, 0.22 / rel)), tight = Math.min(2.6, Math.max(wide * 1.12, 0.28 / rel));
  return { wide: +wide.toFixed(3), tight: +tight.toFixed(3) };
}
export function cropRect(meta, face, tSrc, z) {
  const DW = meta.displayWidth, DH = meta.displayHeight;
  let h = DH, w = DH * 9 / 16; if (w > DW) { w = DW; h = DW * 16 / 9; }
  h /= z; w /= z;
  const f = face.at(tSrc);
  const sx = Math.min(DW - w, Math.max(0, f.x - w / 2));
  const sy = Math.min(DH - h, Math.max(0, f.y - 0.42 * h));
  return { sx, sy, sw: w, sh: h };
}
export function drawComposite(ctx, src, meta, face, plan, t, grade = true) {
  const ts = srcTime(plan, t); const z = zoomAt(plan, t); const r = cropRect(meta, face, ts, z);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  if (grade && "filter" in ctx) ctx.filter = "contrast(1.06) saturate(1.1)";
  drawSource(ctx, src, meta, r.sx, r.sy, r.sw, r.sh, W, H);
  if ("filter" in ctx) ctx.filter = "none";
  drawOverlays(ctx, plan, t);
}

// ---------- Audio ----------
export async function decodeAudio(buffer) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC({ sampleRate: 48000 });
  try { return await ac.decodeAudioData(buffer.slice(0)); }
  catch (e) { throw new UserError("Impossible de lire le son de la vidéo. Exportez-la en MP4 (son AAC)."); }
  finally { ac.close && ac.close(); }
}
export async function to16kMono(ab) {
  const len = Math.ceil(ab.duration * 16000);
  const oc = new OfflineAudioContext(1, len, 16000);
  const src = oc.createBufferSource(); src.buffer = ab; src.connect(oc.destination); src.start();
  const r = await oc.startRendering(); return r.getChannelData(0);
}
function kWeight(x) {
  const y = new Float32Array(x.length);
  const b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], a1 = [-1.69065929318241, 0.73248077421585];
  const b2 = [1, -2, 1], a2 = [-1.99004745483398, 0.99007225036621];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, z1 = 0, z2 = 0, w1 = 0, w2 = 0;
  for (let n = 0; n < x.length; n++) {
    const v = x[n]; const s1 = b1[0] * v + b1[1] * x1 + b1[2] * x2 - a1[0] * y1 - a1[1] * y2; x2 = x1; x1 = v; y2 = y1; y1 = s1;
    const s2 = b2[0] * s1 + b2[1] * z1 + b2[2] * z2 - a2[0] * w1 - a2[1] * w2; z2 = z1; z1 = s1; w2 = w1; w1 = s2; y[n] = s2;
  }
  return y;
}
export function loudness(chs, sr) {
  const k = chs.map(kWeight); const blk = Math.round(0.4 * sr), hop = Math.round(0.1 * sr); const z = [];
  for (let s = 0; s + blk <= k[0].length; s += hop) { let sum = 0; for (const c of k) { let a = 0; for (let n = s; n < s + blk; n++) a += c[n] * c[n]; sum += a / blk; } z.push(sum); }
  const L = v => -0.691 + 10 * Math.log10(v);
  const g1 = z.filter(v => L(v) > -70); if (!g1.length) return -70;
  const m1 = g1.reduce((a, b) => a + b, 0) / g1.length; const g2 = g1.filter(v => L(v) > L(m1) - 10);
  return L(g2.reduce((a, b) => a + b, 0) / g2.length);
}
export async function buildAudio(ab, plan, target = -13) {
  const sr = 48000; const n = Math.round(plan.dur * sr);
  const inCh = [0, Math.min(1, ab.numberOfChannels - 1)].map(c => ab.getChannelData(c));
  const raw = [new Float32Array(n), new Float32Array(n)]; const fade = Math.round(0.012 * sr);
  for (const [s, e, o] of plan.segs) {
    const a = Math.round(s * sr), b = Math.min(Math.round(e * sr), inCh[0].length), off = Math.round(o * sr), len = b - a;
    for (let c = 0; c < 2; c++) for (let i = 0; i < len && off + i < n; i++) {
      let g = 1; if (i < fade) g = i / fade; else if (len - i < fade) g = (len - i) / fade;
      raw[c][off + i] = inCh[c][a + i] * g;
    }
  }
  const oc = new OfflineAudioContext(2, n, sr); const buf = oc.createBuffer(2, n, sr); buf.copyToChannel(raw[0], 0); buf.copyToChannel(raw[1], 1);
  const src = oc.createBufferSource(); src.buffer = buf;
  const hp = oc.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 80;
  const comp = oc.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 6; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.08;
  src.connect(hp); hp.connect(comp); comp.connect(oc.destination); src.start();
  const rendered = await oc.startRendering();
  const ch = [rendered.getChannelData(0).slice(), rendered.getChannelData(1).slice()];
  const L0 = loudness(ch, sr); const gain = L0 <= -69 ? 1 : Math.pow(10, (target - L0) / 20);
  for (const c of ch) for (let i = 0; i < n; i++) c[i] *= gain;
  // limiteur à anticipation (plafond -1,2 dBFS)
  const ceil = Math.pow(10, -1.2 / 20), la = Math.round(0.005 * sr), rel = 1 - Math.exp(-1 / (0.08 * sr));
  const req = new Float32Array(n); for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(ch[0][i]), Math.abs(ch[1][i])); req[i] = p > ceil ? ceil / p : 1; }
  const dq = []; const gmin = new Float32Array(n);
  for (let i = n - 1; i >= 0; i--) { while (dq.length && req[dq[dq.length - 1]] >= req[i]) dq.pop(); dq.push(i); while (dq[0] > i + la) dq.shift(); gmin[i] = req[dq[0]]; }
  let g = 1; for (let i = 0; i < n; i++) { g = gmin[i] < g ? gmin[i] : g + (1 - g) * rel; if (g > gmin[i]) g = gmin[i]; ch[0][i] *= g; ch[1][i] *= g; }
  return { ch, sr, lufsIn: L0, lufsOut: loudness(ch, sr) };
}
export function wavBlob(ch, sr) {
  const n = ch[0].length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 4, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 4, true);
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) { const s = Math.max(-1, Math.min(1, ch[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([buf], { type: "audio/wav" });
}

// ---------- Rendu final ----------
export async function render({ meta, face, plan, audio, support, onProgress, signal, ffmpegLoader }) {
  const vIsAvc = support.vcodec.startsWith("avc"); const useAudioEnc = !!support.acodec;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, fastStart: "in-memory", firstTimestampBehavior: "offset",
    video: { codec: vIsAvc ? "avc" : "vp9", width: W, height: H, frameRate: 30 },
    audio: useAudioEnc ? { codec: support.acodec === "opus" ? "opus" : "aac", numberOfChannels: 2, sampleRate: 48000 } : undefined });
  let encErr = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { encErr = e; } });
  venc.configure({ codec: support.vcodec, width: W, height: H, bitrate: 12_000_000, framerate: 30, latencyMode: "quality", ...(vIsAvc ? { avc: { format: "avc" } } : {}) });

  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d", { alpha: false });
  const N = Math.round(plan.dur * 30); let i = 0; let held = null, heldT = -1;
  const emit = async (srcFrame) => {
    const t = i / 30; drawComposite(ctx, srcFrame, meta, face, plan, t);
    const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / 30), duration: Math.round(1e6 / 30) });
    venc.encode(vf, { keyFrame: i % 60 === 0 }); vf.close(); i++;
    while (venc.encodeQueueSize > 4) await sleep(4);
    if (encErr) throw new UserError("Erreur d'encodage vidéo : " + encErr.message);
    if (signal && signal.aborted) throw new UserError("Rendu annulé.");
    if (i % 10 === 0) onProgress && onProgress(0.05 + 0.85 * i / N, `Image ${i} / ${N}`);
  };
  const lastSrc = srcTime(plan, plan.dur);
  await decodeAll(meta, async f => {
    const ft = f.timestamp / 1e6;
    if (!held) { held = f.clone(); heldT = ft; return; }
    while (i < N && srcTime(plan, i / 30) < ft - 1e-4) await emit(held);
    held.close(); held = f.clone(); heldT = ft;
  }, null, { until: lastSrc });
  while (i < N && held) await emit(held);
  if (held) held.close();
  if (i < N) throw new UserError("La vidéo source est plus courte que prévu : rendu incomplet.");
  await venc.flush(); venc.close();

  onProgress && onProgress(0.92, "Son");
  if (useAudioEnc) {
    let aerr = null;
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => { aerr = e; } });
    aenc.configure({ codec: support.acodec, sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
    const n = audio.ch[0].length, step = 4800;
    for (let s = 0; s < n; s += step) {
      const len = Math.min(step, n - s); const data = new Float32Array(len * 2); data.set(audio.ch[0].subarray(s, s + len), 0); data.set(audio.ch[1].subarray(s, s + len), len);
      const ad = new AudioData({ format: "f32-planar", sampleRate: 48000, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round(s / 48000 * 1e6), data });
      aenc.encode(ad); ad.close(); if (aenc.encodeQueueSize > 20) await sleep(2);
    }
    await aenc.flush(); aenc.close(); if (aerr) throw new UserError("Erreur d'encodage audio : " + aerr.message);
    muxer.finalize();
    return new Blob([target.buffer], { type: "video/mp4" });
  }
  muxer.finalize();
  onProgress && onProgress(0.94, "Son (module de secours)");
  const ff = await ffmpegLoader();
  await ff.writeFile("v.mp4", new Uint8Array(target.buffer));
  await ff.writeFile("a.wav", new Uint8Array(await wavBlob(audio.ch, audio.sr).arrayBuffer()));
  const code = await ff.exec(["-i", "v.mp4", "-i", "a.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", "out.mp4"]);
  if (code !== 0) throw new UserError("Le module audio de secours a échoué. Essayez avec Chrome ou Edge sur Windows ou Mac.");
  const out = await ff.readFile("out.mp4"); await ff.deleteFile("v.mp4"); await ff.deleteFile("a.wav"); await ff.deleteFile("out.mp4");
  return new Blob([out.buffer], { type: "video/mp4" });
}
