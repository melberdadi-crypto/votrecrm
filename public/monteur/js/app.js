import { DEFAULT_DICT, mergeTokens, applyDictionary, removeIntro, detectEvents, addHighlight, buildPlan, srcTime, norm } from "./planner.js";
import * as M from "./media.js";
import { ensureFonts } from "./overlays.js";
import { loadFaceDetector } from "./face.js";

const Q = new URLSearchParams(location.search);
const TEST = Q.has("test"), FORCE_FF = Q.has("forceffmpeg");
const EMBED = Q.has("embed") && window.parent !== window;
if (EMBED) document.body.classList.add("embed");
const $ = s => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem("mri_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("mri_" + k, JSON.stringify(v)); } catch (e) {} }
};
const st = { file: null, buf: null, meta: null, audioBuf: null, words: null, events: null, face: null, plan: null, support: null, zr: null, sel: null, busy: false, abort: null, url: null, outUrl: null };
window.__st = st; // aide au diagnostic

// ---------- erreurs ----------
function showErr(e) {
  console.error(e);
  const msg = e instanceof M.UserError ? e.message : `Erreur inattendue : ${e && e.message ? e.message : e}. Rechargez la page et réessayez ; si le problème continue, essayez Google Chrome à jour.`;
  const b = $("#globalErr"); b.textContent = msg; b.hidden = false; window.scrollTo({ top: 0, behavior: "smooth" });
}
function clearErr() { $("#globalErr").hidden = true; }
window.addEventListener("unhandledrejection", ev => showErr(ev.reason));
window.addEventListener("error", ev => { if (ev.error) showErr(ev.error); });
window.addEventListener("beforeunload", ev => { if (st.busy) { ev.preventDefault(); ev.returnValue = ""; } });

function showStep(n) {
  [1, 2, 3, 4].forEach(k => { $("#s" + k).hidden = k !== n; });
  document.querySelectorAll("#steps li").forEach(li => { const k = +li.dataset.s; li.className = k === n ? "on" : k < n ? "done" : ""; });
}
const setBar = (id, v, txt) => { $("#" + id).style.width = Math.round(Math.max(0, Math.min(1, v)) * 100) + "%"; if (txt != null) $("#" + id + "t").textContent = txt; };
const fmt = t => { t = Math.max(0, t); return Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0"); };
const slug = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// ---------- 1. profil, fichier, compatibilité ----------
const profile = () => ({ name: $("#pName").value.trim(), title: $("#pTitle").value.trim(), region: $("#pRegion").value.trim() });
["pName", "pTitle", "pRegion", "subject", "model"].forEach(id => { const v = store.get(id, null); if (v != null) $("#" + id).value = v; $("#" + id).addEventListener("input", () => store.set(id, $("#" + id).value)); });

(async () => {
  try {
    st.support = await M.checkSupport(TEST, FORCE_FF);
    $("#checks").innerHTML = st.support.items.map(i => `<div class="chk ${i.ok ? (i.warn ? "warn" : "") : "bad"}"><span>${i.label}${!i.ok && i.fix ? `<small>${i.fix}</small>` : ""}</span></div>`).join("");
    updateGo();
  } catch (e) { showErr(e); }
})();
function updateGo() { $("#go").disabled = !(st.file && st.support && st.support.ok); }
function pickFile(f) {
  clearErr();
  if (!f) return;
  if (!/\.(mp4|mov|m4v)$/i.test(f.name) && !/^video\/(mp4|quicktime)/.test(f.type)) { showErr(new M.UserError("Format non pris en charge : choisissez un fichier MP4 ou MOV.")); return; }
  if (f.size > 1.5e9) { showErr(new M.UserError("Fichier trop lourd (plus de 1,5 Go). Filmez en 1080p ou 4K 30 i/s, ou raccourcissez la vidéo.")); return; }
  st.file = f; $("#fileInfo").textContent = `${f.name} · ${(f.size / 1e6).toFixed(1)} Mo`;
  if (!$("#subject").value) $("#subject").value = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 40);
  updateGo();
}
$("#file").addEventListener("change", e => pickFile(e.target.files[0]));
const drop = $("#drop");
["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => pickFile(e.dataTransfer.files[0]));
drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#file").click(); } });
drop.tabIndex = 0;

// ---------- 2. analyse ----------
function transcribe(audio, model) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./asr-worker.js", import.meta.url), { type: "module" });
    const files = {}; let timer = null; const t0 = { v: 0 };
    w.onmessage = ({ data }) => {
      if (data.type === "download") {
        files[data.file] = [data.loaded, data.total];
        const L = Object.values(files).reduce((a, b) => a + b[0], 0), T = Object.values(files).reduce((a, b) => a + b[1], 0);
        setBar("p2", 0.4 * L / T, `Téléchargement du modèle ${(L / 1e6).toFixed(0)} / ${(T / 1e6).toFixed(0)} Mo`);
      } else if (data.type === "stage") {
        const est = Math.max(20, audio.length / 16000 * 1.3); t0.v = performance.now();
        timer = setInterval(() => { const u = Math.min(0.97, (performance.now() - t0.v) / 1000 / est); setBar("p2", 0.4 + 0.6 * u, "Transcription…"); }, 400);
      } else if (data.type === "done") { clearInterval(timer); w.terminate(); setBar("p2", 1, "Terminé"); resolve(data.out); }
      else if (data.type === "error") { clearInterval(timer); w.terminate(); reject(new M.UserError(/fetch|network|Failed to/i.test(data.message) ? "Impossible de télécharger le modèle de transcription. Vérifiez votre connexion Internet puis réessayez." : "Erreur de transcription : " + data.message)); }
    };
    w.onerror = e => { clearInterval(timer); w.terminate(); reject(new M.UserError("Le module de transcription n'a pas pu démarrer : " + (e.message || "erreur inconnue"))); };
    w.postMessage({ audio, model, local: TEST }, [audio.buffer]);
  });
}

$("#go").addEventListener("click", async () => {
  clearErr(); st.busy = true; showStep(2);
  ["p1", "p2", "p3"].forEach(id => setBar(id, 0, ""));
  try {
    setBar("p1", 0.1, "Lecture du fichier…");
    st.buf = await st.file.arrayBuffer();
    st.meta = await M.demux(st.buf);
    if (st.meta.duration > 185) throw new M.UserError(`Vidéo trop longue (${fmt(st.meta.duration)}). Maximum : 3 minutes.`);
    if (st.meta.duration < 3) throw new M.UserError("Vidéo trop courte.");
    if (!st.meta.hasAudio) throw new M.UserError("Cette vidéo n'a pas de son : impossible de faire les sous-titres.");
    setBar("p1", 0.5, "Lecture du son…");
    st.audioBuf = await M.decodeAudio(st.buf);
    setBar("p1", 1, `${st.meta.displayWidth}×${st.meta.displayHeight} · ${fmt(st.meta.duration)}`);
    const mono = await M.to16kMono(st.audioBuf);
    const out = await transcribe(mono, $("#model").value);
    if (!out || !out.chunks || !out.chunks.length) throw new M.UserError("Aucune parole détectée dans la vidéo.");
    let det = null;
    try { det = await loadFaceDetector(); } catch (e) { console.warn("détection du visage indisponible", e); }
    st.face = det ? await M.trackFaces(st.meta, det, p => setBar("p3", p, Math.round(p * 100) + " %")) : M.smoothTrack([], st.meta);
    setBar("p3", 1, st.face.found ? "Visage suivi" : "Visage non détecté : cadrage centré");
    st.words = mergeTokens(out.chunks);
    applyDictionary(st.words, getDict());
    removeIntro(st.words);
    st.events = detectEvents(st.words, profile());
    st.zr = M.zoomRange(st.meta, st.face);
    if (st.url) URL.revokeObjectURL(st.url);
    st.url = URL.createObjectURL(st.file); $("#pvVideo") || makePreviewVideo(); $("#pvVideo").src = st.url;
    await new Promise((res, rej) => { const v = $("#pvVideo"); if (v.readyState >= 1) return res(); v.onloadedmetadata = () => res(); v.onerror = () => res(); });
    rebuild(true); showStep(3); renderDict();
  } catch (e) { showErr(e); showStep(1); }
  finally { st.busy = false; }
});

// ---------- 3. révision ----------
function rebuild(structural) {
  const fr = +$("#framing").value;
  try {
    st.plan = buildPlan(st.words, st.events, { zoomWide: Math.max(1, st.zr.wide * fr), zoomTight: Math.max(1.08, st.zr.tight * fr) });
  } catch (e) { showErr(e); return; }
  if (structural) { renderTranscript(); renderEvents(); }
  $("#scrub").max = Math.round(st.plan.dur * 100);
  previewAt(st.pt || 0);
}
$("#framing").addEventListener("change", () => rebuild(false));

function hlWordSet() { const s = new Set(); for (const e of st.events) if (e.on && e.t === "highlight") for (let k = e.iw; k <= e.iLast; k++) s.add(k); return s; }
function renderTranscript() {
  const hl = hlWordSet(); const mk = new Set(st.events.filter(e => e.on && e.t !== "emoji").map(e => e.i));
  st.events.filter(e => e.on && e.t === "list").forEach(e => e.items.forEach(x => x.i != null && mk.add(x.i)));
  let html = "<p>";
  st.words.forEach((w, i) => {
    const cls = ["w", w.del ? "del" : "", hl.has(i) ? "hl" : "", mk.has(i) ? "mk" : "", i === st.sel ? "sel" : "", !w.w && !w.del ? "empty" : ""].filter(Boolean).join(" ");
    html += `<button class="${cls}" data-i="${i}" type="button">${esc(w.w || w.raw)}</button> `;
    if (/[.?!…]["»]?$/.test(w.w) && !w.del) html += "</p><p>";
  });
  $("#tx").innerHTML = html + "</p>";
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
$("#tx").addEventListener("click", e => {
  const b = e.target.closest(".w"); if (!b) return;
  st.sel = +b.dataset.i; const w = st.words[st.sel];
  $("#edit").hidden = false; $("#eWord").value = w.w; $("#eDel").textContent = w.del ? "Rétablir ce mot" : "Couper ce mot";
  const h = st.events.find(x => x.on && x.t === "highlight" && st.sel >= x.iw && st.sel <= x.iLast);
  $("#eHl").textContent = h ? "Retirer le surlignage" : "Surligner en rouge"; $("#eHlNext").hidden = !h;
  document.querySelectorAll(".w.sel").forEach(x => x.classList.remove("sel")); b.classList.add("sel");
  if (st.plan) { const ow = st.plan.words[st.sel]; if (ow && !ow.del) previewAt(ow.os + 0.05); }
});
$("#eWord").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commitWord(); } });
$("#eWord").addEventListener("change", commitWord);
function commitWord() { if (st.sel == null) return; const v = $("#eWord").value.replace(/'/g, "’").trim(); if (v === st.words[st.sel].w) return; st.words[st.sel].w = v; refreshHighlightTexts(); rebuild(true); }
$("#eDel").addEventListener("click", () => { if (st.sel == null) return; const w = st.words[st.sel]; w.del = !w.del; $("#eDel").textContent = w.del ? "Rétablir ce mot" : "Couper ce mot"; rebuild(true); });
$("#eHl").addEventListener("click", () => {
  if (st.sel == null) return; const i = st.sel;
  const h = st.events.find(x => x.on && x.t === "highlight" && i >= x.iw && i <= x.iLast);
  if (h) st.events.splice(st.events.indexOf(h), 1); else addHighlight(st.words, st.events, i, i);
  st.events.sort((a, b) => a.i - b.i); rebuild(true); $("#tx").querySelector(`[data-i="${i}"]`)?.click();
});
$("#eHlNext").addEventListener("click", () => {
  const i = st.sel; const h = st.events.find(x => x.on && x.t === "highlight" && i >= x.iw && i <= x.iLast); if (!h) return;
  let n = h.iLast + 1; while (n < st.words.length && (st.words[n].del || !st.words[n].w)) n++;
  if (n >= st.words.length) return; h.iLast = n; refreshHighlightTexts(); rebuild(true);
});
function refreshHighlightTexts() {
  for (const h of st.events.filter(x => x.t === "highlight")) {
    const ids = []; for (let k = h.iw; k <= h.iLast; k++) if (!st.words[k].del && st.words[k].w) ids.push(k);
    h.word = ids.map(k => st.words[k].w.replace(/[.,!?;:…]+$/, "")).join(" ");
  }
}

const LABEL = { statRouge: "Chiffre rouge", statBlanc: "Chiffre blanc", montant: "Montant", section: "Section", list: "Liste", name: "Présentation", cta: "Appel à l'action", highlight: "Mot surligné", emoji: "Emoji (accroche)" };
const FIELDS = { statRouge: [["main", "Texte"]], statBlanc: [["main", "Chiffre"], ["sub", "Sous-texte"]], montant: [["main", "Montant"], ["top", "Petit texte en haut"], ["sub", "Petit texte en bas"]],
  section: [["txt", "Titre"]], list: [["items", "Une ligne par élément", 1]], name: [["lines", "Lignes (nom, titre, région)", 1]], cta: [["lines", "Lignes de la bulle", 1]],
  highlight: [["line", "Phrase avant"], ["word", "Mot en rouge"]], emoji: [["txt", "Emoji (vide = aucun)"]] };
function evStart(e) { const w = st.plan.words; let k = e.i; while (k < w.length && (w[k].del || !w[k].w)) k++; return k < w.length ? w[k].os : st.plan.dur; }
function renderEvents() {
  const list = st.events.slice().sort((a, b) => evStart(a) - evStart(b));
  $("#ovlist").innerHTML = list.map(e => {
    const f = FIELDS[e.t] || [];
    const val = (k) => k === "items" ? e.items.map(x => x.txt).join("\n") : k === "lines" ? e.lines.join("\n") : (e[k] ?? "");
    return `<div class="ev ${e.on ? "" : "off"}" data-id="${e.id}"><div class="hd"><span class="tag ${e.t}">${LABEL[e.t] || e.t}</span><span class="tc">${fmt(evStart(e))}</span>
      <span class="row" style="flex:0 0 auto;gap:6px"><button class="btn small" data-act="go" type="button">Voir</button><label class="hint" style="display:flex;gap:4px;align-items:center"><input type="checkbox" data-act="on" ${e.on ? "checked" : ""}> Afficher</label></span></div>
      ${f.map(([k, lab, multi]) => `<label class="f">${lab}${multi ? `<textarea data-k="${k}" rows="3">${esc(val(k))}</textarea>` : `<input type="text" data-k="${k}" value="${esc(val(k))}">`}</label>`).join("")}</div>`;
  }).join("") || `<p class="hint">Aucun graphique détecté. Cliquez sur un mot du texte pour le surligner.</p>`;
}
$("#ovlist").addEventListener("input", e => {
  const card = e.target.closest(".ev"); if (!card) return; const ev = st.events.find(x => x.id === +card.dataset.id); if (!ev) return;
  const k = e.target.dataset.k;
  if (e.target.dataset.act === "on") { ev.on = e.target.checked; card.classList.toggle("off", !ev.on); rebuild(false); renderTranscript(); return; }
  if (!k) return; const v = e.target.value.replace(/'/g, "’");
  if (k === "items") { const lines = v.split("\n").map(s => s.trim()); ev.items = lines.map((txt, n) => ({ txt, i: ev.items[n] ? ev.items[n].i : null })).filter((x, n) => x.txt || n < lines.length - 1); }
  else if (k === "lines") ev.lines = v.split("\n").map(s => s.trim()).filter(Boolean);
  else ev[k] = v;
  rebuild(false);
  const ps = st.plan.ev.find(x => Math.abs(x.s - evStart(ev)) < 0.05 && x.t === ev.t); if (ps) previewAt(Math.min(ps.e - 0.05, ps.s + 0.9));
});
$("#ovlist").addEventListener("click", e => { if (e.target.dataset.act !== "go") return; const ev = st.events.find(x => x.id === +e.target.closest(".ev").dataset.id); previewAt(evStart(ev) + 0.9); });

// dictionnaire
function getDict() { return store.get("dict", DEFAULT_DICT); }
function renderDict() { $("#dict").innerHTML = getDict().map(([a, b], k) => `<div><span>${esc(a)} → <b>${esc(b)}</b></span><button class="btn small" data-k="${k}" type="button" aria-label="Supprimer">✕</button></div>`).join(""); }
$("#dict").addEventListener("click", e => { const k = e.target.dataset.k; if (k == null) return; const d = getDict(); d.splice(+k, 1); store.set("dict", d); renderDict(); });
$("#dAdd").addEventListener("click", () => {
  const a = $("#dFrom").value.trim(), b = $("#dTo").value.trim(); if (!a || !b) return;
  const d = getDict().filter(x => norm(x[0]) !== norm(a)); d.unshift([a, b]); store.set("dict", d); renderDict();
  applyDictionary(st.words, [[a, b]]); refreshHighlightTexts(); rebuild(true); $("#dFrom").value = $("#dTo").value = "";
});

// aperçu
function makePreviewVideo() { const v = document.createElement("video"); v.id = "pvVideo"; v.playsInline = true; v.preload = "auto"; v.hidden = true; document.body.appendChild(v); return v; }
let seeking = false, wanted = null;
async function previewAt(t) {
  st.pt = Math.max(0, Math.min(st.plan ? st.plan.dur - 0.01 : 0, t)); wanted = st.pt;
  $("#scrub").value = Math.round(st.pt * 100); $("#tcode").textContent = `${fmt(st.pt)} / ${fmt(st.plan.dur)}`;
  if (seeking || playing) return; seeking = true;
  const v = $("#pvVideo");
  try {
    while (wanted != null) {
      const tt = wanted; wanted = null; const ts = srcTime(st.plan, tt);
      if (v.readyState >= 1 && Math.abs(v.currentTime - ts) > 0.015) { await new Promise(res => { const done = () => { v.removeEventListener("seeked", done); res(); }; v.addEventListener("seeked", done); v.currentTime = ts; setTimeout(done, 1500); }); }
      drawPv(tt);
    }
  } finally { seeking = false; }
}
function drawPv(t) {
  const ctx = $("#pv").getContext("2d"); ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
  const v = $("#pvVideo");
  if (v.readyState >= 2) M.drawComposite(ctx, v, { ...st.meta, rotation: 0, displayWidth: v.videoWidth || st.meta.displayWidth, displayHeight: v.videoHeight || st.meta.displayHeight }, st.face, st.plan, t);
  else { ctx.fillStyle = "#222"; ctx.fillRect(0, 0, 1080, 1920); }
}
$("#scrub").addEventListener("input", e => previewAt(+e.target.value / 100));
let playing = false;
$("#play").addEventListener("click", async () => {
  const v = $("#pvVideo");
  if (playing) { playing = false; v.pause(); $("#play").textContent = "Lire"; return; }
  playing = true; $("#play").textContent = "Pause";
  const segs = st.plan.segs; let k = segs.findIndex(([s, e, o]) => st.pt < o + (e - s)); if (k < 0) k = 0;
  v.currentTime = srcTime(st.plan, st.pt);
  try { await v.play(); } catch (e) { playing = false; $("#play").textContent = "Lire"; return; }
  const loop = () => {
    if (!playing) return;
    const [s, e, o] = segs[k];
    if (v.currentTime >= e - 0.02) { k++; if (k >= segs.length) { playing = false; v.pause(); $("#play").textContent = "Lire"; return; } v.currentTime = segs[k][0]; }
    const t = segs[k][2] + Math.max(0, v.currentTime - segs[k][0]); st.pt = t;
    $("#scrub").value = Math.round(t * 100); $("#tcode").textContent = `${fmt(t)} / ${fmt(st.plan.dur)}`; drawPv(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});

// validation
document.querySelectorAll(".vc").forEach(c => c.addEventListener("change", () => { $("#renderBtn").disabled = ![...document.querySelectorAll(".vc")].every(x => x.checked); }));

// ---------- 4. export ----------
async function ffmpegLoader() {
  const { FFmpeg } = await import("../vendor/ffmpeg/index.js");
  const ff = new FFmpeg();
  await ff.load({ coreURL: new URL("../vendor/ffmpeg-core/ffmpeg-core.js", import.meta.url).href, wasmURL: new URL("/ffmpeg/ffmpeg-core.wasm", location.origin).href, classWorkerURL: new URL("../vendor/ffmpeg/worker.js", import.meta.url).href });
  return ff;
}
function srt(plan) {
  const tc = t => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000); return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
  return plan.caps.map((c, k) => `${k + 1}\n${tc(c.s)} --> ${tc(c.e)}\n${c.txt}\n`).join("\n");
}
$("#renderBtn").addEventListener("click", async () => {
  clearErr(); if (playing) $("#play").click();
  showStep(4); $("#renderPanel").hidden = false; $("#resultPanel").hidden = true; setBar("r1", 0, ""); $("#r1l").textContent = "Préparation";
  st.busy = true; st.abort = new AbortController();
  try {
    await ensureFonts();
    $("#r1l").textContent = "Son"; const audio = await M.buildAudio(st.audioBuf, st.plan);
    $("#r1l").textContent = "Rendu des images";
    const t0 = performance.now();
    const blob = await M.render({ meta: st.meta, face: st.face, plan: st.plan, audio, support: st.support, signal: st.abort.signal, ffmpegLoader,
      onProgress: (p, txt) => { const el = (performance.now() - t0) / 1000; const eta = p > 0.08 ? el / p * (1 - p) : null; setBar("r1", p, `${txt}${eta ? ` · reste ≈ ${fmt(eta)}` : ""}`); } });
    setBar("r1", 1, "Terminé");
    if (st.outUrl) URL.revokeObjectURL(st.outUrl);
    st.outUrl = URL.createObjectURL(blob);
    const p = profile(); const name = `${slug(p.name) || "Reel"}_${slug($("#subject").value) || "video"}_${new Date().toISOString().slice(0, 10)}_9x16.mp4`;
    $("#out").src = st.outUrl; $("#dl").href = st.outUrl; $("#dl").download = name;
    $("#dlSrt").href = URL.createObjectURL(new Blob([srt(st.plan)], { type: "text/plain" })); $("#dlSrt").download = name.replace(/_9x16\.mp4$/, ".srt");
    $("#outInfo").textContent = `${name} · ${fmt(st.plan.dur)} · 1080×1920 · 30 i/s · ${(blob.size / 1e6).toFixed(1)} Mo · son ${audio.lufsOut.toFixed(1)} LUFS`;
    $("#renderPanel").hidden = true; $("#resultPanel").hidden = false;
    st.lastBlob = blob; st.lastName = name; $("#saveCrm").hidden = !(EMBED && Q.has("save")); $("#pubCrm").hidden = !(EMBED && Q.has("publish")); $("#pubCrm").disabled = false; $("#saveCrm").disabled = false; $("#saveMsg").textContent = "";
  } catch (e) { showErr(e); showStep(3); }
  finally { st.busy = false; }
});
$("#cancel").addEventListener("click", () => st.abort && st.abort.abort());
$("#back").addEventListener("click", () => { showStep(3); previewAt(st.pt || 0); });
$("#restart").addEventListener("click", () => location.reload());
// Intégration au CRM : la vidéo finie est transmise à la page parente (même origine), qui l'enregistre.
$("#pubCrm").addEventListener("click", () => {
  if (!EMBED || !st.lastBlob) return;
  const texte = st.plan ? st.plan.words.filter(w => !w.del && w.w).map(w => w.w).join(" ") : "";
  window.parent.postMessage({ type: "monteur:publier", blob: st.lastBlob, name: st.lastName, texte, duration: st.plan ? st.plan.dur : null }, location.origin);
  $("#saveMsg").textContent = "Fenêtre de publication ouverte dans le CRM.";
});
$("#saveCrm").addEventListener("click", () => {
  if (!EMBED || !st.lastBlob) return;
  $("#saveCrm").disabled = true; $("#saveMsg").textContent = "Envoi au CRM…";
  window.parent.postMessage({ type: "monteur:video", blob: st.lastBlob, name: st.lastName, duration: st.plan ? st.plan.dur : null }, location.origin);
});
window.addEventListener("message", ev => {
  if (!EMBED || ev.origin !== location.origin || ev.source !== window.parent || !ev.data) return;
  if (ev.data.type === "monteur:saved") { $("#saveMsg").textContent = "Vidéo enregistrée dans le CRM."; }
  if (ev.data.type === "monteur:error") { $("#saveMsg").textContent = "Échec de l'enregistrement : " + (ev.data.message || "erreur inconnue") + ". Vous pouvez réessayer ou télécharger la vidéo."; $("#saveCrm").disabled = false; }
});
showStep(1);
