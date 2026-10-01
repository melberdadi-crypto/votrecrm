// Planificateur automatique : transcription -> plan de montage (coupes, sous-titres, overlays, zooms).
// Module pur (aucune dépendance au navigateur) : testable dans Node.

export const DEFAULT_DICT = [
  ["racheteurs", "acheteurs"], ["l'assamption", "L'Assomption"], ["l'assomption", "L'Assomption"],
  ["assomption", "Assomption"], ["rive nord", "Rive-Nord"], ["rive sud", "Rive-Sud"], ["la nondière", "Lanaudière"],
  ["nondière", "Lanaudière"], ["négements", "déneigement"], ["pâti noire", "patinoire"], ["était comme hiver", "été comme hiver"],
  ["second cousteau", "Séguin-Cousteau"], ["seconde costaud", "Séguin-Cousteau"], ["molly cool", "Molly-Kool"],
  ["centris", "Centris"], ["laval", "Laval"], ["fabreville", "Fabreville"], ["sainte-rose", "Sainte-Rose"],
  ["chomedey", "Chomedey"], ["vous magasiner", "vous magasinez"], ["capitaine molly cool", "Capitaine-Molly-Kool"], ["fabreville ouest", "Fabreville-Ouest"],
  ["s'engiez", "songez à"], ["sangez d'éménager", "songez à déménager"], ["s'engiez déménager", "songez à déménager"], ["pâti noire réfrigérée", "patinoire réfrigérée"], ["un cours commentaire", "un court commentaire"], ["hypothèque", "hypothèque"], ["vimont", "Vimont"], ["auteuil", "Auteuil"], ["terrebonne", "Terrebonne"],
  ["mascouche", "Mascouche"], ["blainville", "Blainville"], ["boisbriand", "Boisbriand"], ["mirabel", "Mirabel"]
];

const GREET = new Set(["ok", "okay", "bonjour", "salut", "allô", "allo", "hello", "hey", "bon", "alors", "hi", "yo", "voilà"]);
const WEAK = new Set(["à", "de", "en", "le", "la", "les", "des", "du", "un", "une", "et", "que", "votre", "vos", "ce", "se", "sur", "pour", "dans", "au", "aux", "par", "mon", "ma", "mes", "son", "sa", "ses", "notre", "nos", "leur", "leurs", "qui", "ou"]);
const ART = new Set(["le", "la", "les", "l’", "l'", "un", "une", "des", "du", "de", "d’", "d'", "en", "au", "aux"]);
const LINKERS = new Set(["donc", "puis", "et", "ainsi", "aussi", "mais", "ensuite", "enfin"]);
const ADVERBS = new Set(["souvent", "donc", "mais", "alors", "aussi", "ensuite", "bref", "enfin", "oui", "non", "ok", "bon", "voilà", "parfois", "toujours", "évidemment", "bien", "sûr"]);
const ORD = /^(premièrement|deuxièmement|troisièmement|quatrièmement|cinquièmement|sixièmement|septièmement|finalement)$/;
const ORD_N = { premièrement: 1, deuxièmement: 2, troisièmement: 3, quatrièmement: 4, cinquièmement: 5, sixièmement: 6, septièmement: 7 };
const MONTHS = new Set(["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]);
const UNIT_STOP = new Set(["ans", "an", "fois"]);
const HL_PATTERNS = [/^chaque (mois|année|semaine|jour)$/, /^(dès le )?premier jour$/, /^qualité de vie$/, /^sans frais$/, /^gratuit(e|ement)?$/];

export const norm = s => (s || "").toLowerCase().replace(/[’`]/g, "'").replace(/[«»"“”.,!?;:…()]/g, "").replace(/\s+/g, " ").trim();
const clean = s => (s || "").replace(/[«»"“”.,!?;:…]+$/g, "").replace(/^[«»"“”]+/, "");
const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const typo = s => s.replace(/'/g, "’");

// ---------- 1. Jetons Whisper -> mots ----------
export function mergeTokens(chunks) {
  const W = [];
  for (const c of chunks) {
    let t = (c.text || "").trim();
    const s = c.timestamp[0], e = c.timestamp[1] ?? c.timestamp[0];
    if (!t) continue;
    const prev = W[W.length - 1];
    if (prev && (/^['’-]/.test(t) || (/^[.,]\d/.test(t) && /\d$/.test(prev.raw)))) {
      prev.raw += t.replace(/^\./, ",");
      prev.e = Math.max(prev.e, e);
      continue;
    }
    W.push({ raw: t, s, e });
  }
  return W.map((w, i) => ({ id: i, w: typo(w.raw), raw: w.raw, s: w.s, e: Math.max(w.e, w.s + 0.04), del: false }));
}

// ---------- 2. Dictionnaire de corrections (expressions de 1 à 4 mots) ----------
export function applyDictionary(words, dict) {
  const entries = dict.filter(d => d[0] && d[1]).map(([a, b]) => [norm(a).split(" "), b]).sort((x, y) => y[0].length - x[0].length);
  for (let i = 0; i < words.length; i++) {
    for (const [pat, rep] of entries) {
      if (i + pat.length > words.length) continue;
      let ok = true;
      for (let k = 0; k < pat.length; k++) if (norm(words[i + k].w) !== pat[k]) { ok = false; break; }
      if (!ok) continue;
      const last = words[i + pat.length - 1].w;
      const trail = (last.match(/[.,!?;:…]+$/) || [""])[0];
      const lead = (words[i].w.match(/^[«"]+/) || [""])[0];
      let r = typo(rep); if (/^[A-ZÀ-Ý]/.test(words[i].w.replace(/^[«"]+/, "")) && /^[a-zà-ÿ]/.test(r)) r = cap1(r);
      words[i].w = lead + r + trail;
      for (let k = 1; k < pat.length; k++) words[i + k].w = "";
      i += pat.length - 1;
      break;
    }
  }
  return words;
}

// ---------- 3. Détection automatique ----------
function sentences(words) {
  const out = []; let cur = [];
  words.forEach((w, i) => { if (w.del) return; cur.push(i); if (/[.?!…]["»]?$/.test(w.w)) { out.push(cur); cur = []; } });
  if (cur.length) out.push(cur);
  return out;
}
const alive = (words, idx) => idx.filter(i => !words[i].del && words[i].w);

export function removeIntro(words) {
  for (const w of words) {
    if (w.del) continue;
    if (GREET.has(norm(w.w))) { w.del = true; continue; }
    break;
  }
}

export function detectEvents(words, profile = {}) {
  const ev = [];
  const sents = sentences(words);
  const sentOf = i => sents.findIndex(s => s.includes(i));
  const nextSentStart = i => { const k = sentOf(i); return k >= 0 && k + 1 < sents.length ? sents[k + 1][0] : null; };
  const used = new Set();
  let uid = 1; const add = e => { e.id = uid++; e.on = true; ev.push(e); return e; };

  // Présentation : « moi c'est », « je m'appelle »
  let nameEv = null;
  for (let i = 0; i < words.length - 2; i++) {
    const a = norm(words[i].w), b = norm(words[i + 1].w);
    const isMoi = (a === "moi" && b === "c'est") || (a === "je" && b === "m'appelle");
    if (!isMoi || words[i].del) continue;
    // remplacer le nom transcrit par le nom du profil
    let j = i + 2; const nameIdx = [];
    while (j < words.length && nameIdx.length < 4) { nameIdx.push(j); if (/[,.!?]$/.test(words[j].w)) break; j++; }
    if (profile.name && nameIdx.length) {
      const trail = (words[nameIdx[nameIdx.length - 1]].w.match(/[,.!?]+$/) || [""])[0];
      words[nameIdx[0]].w = profile.name + trail;
      nameIdx.slice(1).forEach(k => words[k].w = "");
    }
    const lines = [profile.name || nameIdx.map(k => clean(words[k].w)).join(" "), profile.title || "Courtier immobilier", profile.region || ""].filter(Boolean);
    nameEv = add({ t: "name", i, iEnd: null, lines });
    break;
  }

  // Appel à l'action
  let ctaEv = null;
  const CTA_V = /^(écrivez|écrivez-moi|écrire|m'écrire|veuillez|commentez|envoyez|envoyez-moi|appelez|appelez-moi|remplissez|cliquez|abonnez-vous|contactez|contactez-moi|texte|textez-moi|réservez)$/;
  const CTA_K = /commentaire|message|formulaire|lien|appelle|appelez|écri|contact|réserv|abonn|texte/;
  for (let k = sents.length - 1; k >= 0 && !ctaEv; k--) {
    const ids = alive(words, sents[k]);
    const txt = ids.map(i => norm(words[i].w)).join(" ");
    if (!CTA_K.test(txt)) continue;
    const startIdx = ids.find(i => CTA_V.test(norm(words[i].w)));
    if (startIdx == null) continue;
    const from = ids.slice(ids.indexOf(startIdx));
    const ft = from.map(i => norm(words[i].w)).join(" ");
    let lines;
    const kw = (() => { const q = from.map(i => words[i].w).join(" ").match(/[«"]\s*([^»"]+?)\s*[»"]/); if (q) return q[1];
      const m = from.findIndex(i => /^(message|messages)$/.test(norm(words[i].w)));
      if (m > 1) { const between = from.slice(1, m - 1).map(i => clean(words[i].w)).filter(x => x && !/^(en|par|un|le|moi|-moi)$/i.test(x)); if (between.length && between.length <= 2) return between.join(" "); }
      return ""; })();
    if (/formulaire/.test(ft)) lines = ["Remplissez", "le formulaire", "ci-dessous"];
    else if (/message/.test(ft)) lines = kw ? ["Écrivez-moi", "« " + kw.toUpperCase() + " »", "en message privé"] : ["Écrivez-moi", "en message privé"];
    else if (/commentaire/.test(ft)) lines = kw ? ["Écrivez", "« " + kw.toUpperCase() + " »", "en commentaire"] : ["Écrivez-moi", "un court commentaire"];
    else if (/lien/.test(ft)) lines = ["Cliquez sur", "le lien en bio"];
    else lines = ["Contactez-moi"];
    if (/appelle|rappelle/.test(ft) && lines.length < 3) lines.push("et je vous appelle");
    ctaEv = add({ t: "cta", i: startIdx, iEnd: null, lines });
  }

  // Sections (premièrement, deuxièmement…)
  const sections = [];
  words.forEach((w, i) => {
    if (w.del || !ORD.test(norm(w.w))) return;
    const n = ORD_N[norm(w.w)] || sections.length + 1;
    const ids = []; let j = i + 1;
    if (!/[,.:]$/.test(w.w) || true) {
      while (j < words.length && ids.length < 6) { if (!words[j].del && words[j].w) ids.push(j); if (/[,.:!?]$/.test(words[j].w)) break; j++; }
    }
    let toks = ids.map(k => clean(words[k].w));
    while (toks.length && /^(c’est|c'est|il|y|a|ce|sont|est)$/i.test(toks[0])) toks.shift();
    while (toks.length && ART.has(toks[0].toLowerCase())) toks.shift();
    toks = toks.map(t => t.replace(/^[ld]’/i, ""));
    const words3 = toks.slice(0, 3);
    while (words3.length > 1 && WEAK.has(words3[words3.length - 1].toLowerCase())) words3.pop();
    const title = cap1(words3.join(" ").replace(/-/g, "‑").replace(/‑/g, "-"));
    sections.push(add({ t: "section", i, iEnd: null, txt: `${n}. ${title}` }));
  });

  // Listes (au moins 3 éléments courts séparés par des virgules / puis / ainsi que / et)
  sents.forEach(sidx => {
    const ids = alive(words, sidx);
    const pieces = []; let cur = [];
    const flush = () => { if (cur.length) pieces.push(cur); cur = []; };
    for (let p = 0; p < ids.length; p++) {
      const i = ids[p], n = norm(words[i].w);
      if ((n === "puis" || n === "et" || (n === "ainsi" && ids[p + 1] != null && norm(words[ids[p + 1]].w) === "que")) && cur.length) { flush(); }
      cur.push(i);
      if (/[,;:]$/.test(words[i].w)) flush();
    }
    flush();
    const content = pc => { let c = pc.slice(); while (c.length && (LINKERS.has(norm(words[c[0]].w)) || norm(words[c[0]].w) === "que")) c.shift(); return c; };
    const okPiece = (pc, first) => { const c = content(pc); if (!c.length || c.length > 4) return false;
      if (c.length === 1 && ADVERBS.has(norm(words[c[0]].w))) return false;
      if (ORD.test(norm(words[c[0]].w))) return false;
      if (first && /^(au|aux|voici|il|c'est|ce)$/.test(norm(words[c[0]].w))) return false;
      if (c.some(i => /\d/.test(words[i].w))) return false; return true; };
    let best = null;
    for (let a = 0; a < pieces.length; a++) {
      let b = a; while (b < pieces.length && okPiece(pieces[b], b === 0)) b++;
      if (b - a >= 3 && (!best || b - a > best[1] - best[0])) best = [a, b];
      if (b > a) a = b - 1;
    }
    if (!best) return;
    let runs = pieces.slice(best[0], best[1]).map(content);
    // élément précédent long qui se termine par « article + nom » (ex. « ce qui veut dire la toiture »)
    if (best[0] > 0) { const pv = content(pieces[best[0] - 1]); if (pv.length > 4) { const t2 = pv.slice(-2); if (ART.has(norm(words[t2[0]].w))) runs.unshift(t2); } }
    const items = runs.map(c => { let toks = c.map(k => clean(words[k].w)).filter(Boolean); while (toks.length > 1 && ART.has(toks[0].toLowerCase())) toks.shift();
      toks = toks.map((t, x) => x === 0 ? t.replace(/^[ld]’/i, "") : t); return { txt: cap1(toks.join(" ")), i: c[0] }; }).filter(x => x.txt);
    if (items.length < 3) return;
    items.forEach(x => used.add(x.i));
    add({ t: "list", i: items[0].i, items, iEnd: null });
  });

  // Chiffres et montants
  for (let i = 0; i < words.length; i++) {
    const w = words[i]; if (w.del || !/\d/.test(w.w)) continue;
    const num = clean(w.w).replace(/\s/g, "");
    if (/^(19|20)\d\d$/.test(num)) continue;            // année
    const nx = [1, 2, 3, 4].map(k => words[i + k] ? norm(words[i + k].w) : "");
    const pv = words[i - 1] ? norm(words[i - 1].w) : "", pv2 = words[i - 2] ? norm(words[i - 2].w) : "";
    let e = null;
    const top = /^(près|plus|moins|environ)$/.test(pv2) && pv === "de" ? (pv2 === "près" ? "PRÈS DE" : pv2 === "plus" ? "PLUS DE" : pv2 === "moins" ? "MOINS DE" : "") : (pv === "environ" ? "ENVIRON" : "");
    if (/^(millions?|milliards?)$/.test(nx[0]) && (/dollars?|\$/.test(nx[1] + nx[2]) )) e = { t: "montant", main: `${num} ${/^milliard/.test(nx[0]) ? "G$" : "M$"}`, top, sub: "" };
    else if (/^(mille)$/.test(nx[0]) && /dollars?|\$/.test(nx[1] + nx[2])) e = { t: "montant", main: `${num} 000 $`, top, sub: "" };
    else if (/^(\$|dollars?)$/.test(nx[0]) || /\$$/.test(w.w)) e = { t: "montant", main: `${num.replace(/\$$/, "")} $`, top, sub: "" };
    else if (/^%$|^pour$/.test(nx[0]) && (nx[0] === "%" || nx[1] === "cent") || /%$/.test(w.w)) e = { t: "statBlanc", main: `${num.replace(/%$/, "")} %`.replace(/^\+?/, (s) => s), sub: "" };
    else if (nx[0] && !WEAK.has(nx[0]) && !UNIT_STOP.has(nx[0]) && /^[a-zà-ÿ-]+$/.test(nx[0])) e = { t: "statRouge", main: `${num} ${clean(words[i + 1].w)}`.toUpperCase() };
    if (!e) continue;
    e.i = i; e.iEnd = null; add(e);
  }

  // Accroche : 1re phrase
  if (sents.length) {
    const s0 = alive(words, sents[0]);
    const capWord = s0.slice(1).find(i => /^[A-ZÉÈÀ]/.test(clean(words[i].w)) && clean(words[i].w).length >= 4 && !/^(Je|Vous|Nous|Moi)$/.test(clean(words[i].w)));
    const hasStat = ev.some(e => (e.t === "statRouge" || e.t === "montant" || e.t === "statBlanc") && s0.includes(e.i));
    if (!hasStat) {
      if (capWord != null) add({ t: "statRouge", i: capWord, iEnd: null, main: clean(words[capWord].w).toUpperCase(), hook: true });
      else if (/\?$/.test(words[s0[s0.length - 1]].w)) { const li = s0[s0.length - 1]; add({ t: "statRouge", i: li, iEnd: null, main: clean(words[li].w).toUpperCase() + " ?", hook: true }); }
    }
    add({ t: "emoji", i: s0[0], iEnd: s0[s0.length - 1], txt: "🏠" });
  }

  // Mots surlignés automatiques (motifs connus, 3 max)
  let nh = 0;
  for (let i = 0; i < words.length && nh < 3; i++) {
    for (let len = 4; len >= 1; len--) {
      const ids = []; let j = i; while (ids.length < len && j < words.length) { if (!words[j].del && words[j].w) ids.push(j); j++; }
      if (ids.length < len) continue;
      const phrase = ids.map(k => norm(words[k].w)).join(" ");
      if (HL_PATTERNS.some(r => r.test(phrase))) { addHighlight(words, ev, ids[0], ids[ids.length - 1], add); nh++; i = ids[ids.length - 1]; break; }
    }
  }
  return ev.sort((a, b) => a.i - b.i);
}

export function addHighlight(words, ev, iw, iLast, addFn) {
  const sents = sentences(words);
  const s = sents.find(x => x.includes(iw)) || [];
  const prevIds = alive(words, s.filter(k => k < iw)); const before = [];
  for (let k = prevIds.length - 1; k >= 0 && before.length < 6; k--) { if (before.length && /[,;:]$/.test(words[prevIds[k]].w)) break; before.unshift(prevIds[k]); }
  const line = cap1(before.map(k => clean(words[k].w)).join(" "));
  const word = alive(words, Array.from({ length: iLast - iw + 1 }, (_, k) => iw + k)).map(k => clean(words[k].w)).join(" ");
  const e = { t: "highlight", i: before.length ? before[0] : iw, iw, iLast, line, word };
  if (addFn) return addFn(e);
  e.id = Math.max(0, ...ev.map(x => x.id)) + 1; e.on = true; ev.push(e); return e;
}

// ---------- 4. Construction du plan ----------
export function buildPlan(words, events, opt = {}) {
  const GAP = opt.gap ?? 0.25, PRE = 0.06, POST = 0.12, FPS = 30;
  const live = words.filter(w => !w.del);
  if (!live.length) throw new Error("Aucun mot conservé : impossible de construire le montage.");
  // segments à garder
  const segs = []; let cs = Math.max(0, live[0].s - PRE), ce = live[0].e;
  for (let k = 1; k < live.length; k++) {
    const w = live[k], prevW = live[k - 1];
    const contiguous = words.slice(prevW.id + 1, w.id).every(x => !x.del);
    if (w.s - ce > GAP || !contiguous) { segs.push([cs, ce + POST]); cs = Math.max(w.s - PRE, ce + POST); }
    ce = Math.max(ce, w.e);
  }
  segs.push([cs, ce + 0.45]);
  for (let k = 1; k < segs.length; k++) if (segs[k][0] < segs[k - 1][1]) segs[k][0] = segs[k - 1][1];
  let o = 0; const out = segs.filter(s => s[1] - s[0] > 0.05).map(([s, e]) => { const r = [s, e, o]; o += e - s; return r; });
  const DUR = o;
  const map = t => { for (const [s, e, oo] of out) { if (t <= e + 1e-6) return oo + Math.max(0, t - s); } return DUR; };
  const OW = words.map(w => ({ ...w, os: map(w.s), oe: map(w.e) }));
  const firstLive = i => { for (let k = i; k < OW.length; k++) if (!OW[k].del && OW[k].w) return k; return null; };
  const S = i => { const k = i == null ? null : firstLive(i); return k == null ? DUR : OW[k].os; };
  const E = i => { if (i == null) return DUR; for (let k = i; k >= 0; k--) if (!OW[k].del && OW[k].w) return OW[k].oe; return 0; };

  const sents = sentences(OW);
  const sentEndAfter = i => { const s = sents.find(x => x.includes(firstLive(i))); return s ? E(s[s.length - 1]) : DUR; };
  const nextSentStartAfter = i => { const k = sents.findIndex(x => x.includes(firstLive(i))); return k >= 0 && k + 1 < sents.length ? S(sents[k + 1][0]) : DUR; };

  const on = events.filter(e => e.on && !(e.t === "list" && !(e.items || []).filter(x => x.txt).length) && !((e.t === "name" || e.t === "cta") && !(e.lines || []).filter(Boolean).length)).map(e => e.t === "list" ? { ...e, items: e.items.filter(x => x.txt) } : e);
  const starts = on.filter(e => ["section", "name", "cta"].includes(e.t)).map(e => S(e.i)).sort((a, b) => a - b);
  const nextBlock = t => starts.find(x => x > t + 0.01) ?? DUR;
  const ev = []; const supp = [];
  for (const e of on) {
    const s = S(e.i);
    if (e.t === "section") ev.push({ t: "section", s, e: nextBlock(s), txt: e.txt });
    else if (e.t === "name") ev.push({ t: "name", s, e: Math.min(nextBlock(s), s + 5), lines: e.lines });
    else if (e.t === "cta") { const end = Math.min(DUR, Math.max(sentEndAfter(e.i) + 0.4, s + 2.5)); ev.push({ t: "cta", s, e: end, lines: e.lines }); supp.push([s, end]); }
    else if (e.t === "list") { const at = []; e.items.forEach((x, k) => at.push(x.i != null ? S(x.i) : (k ? at[k - 1] + 0.4 : S(e.i)))); const ns = nextSentStartAfter(e.items.map(x => x.i).filter(x => x != null).pop() ?? e.i); const end = Math.max(ns, at[at.length - 1] + 0.7); ev.push({ t: "list", s: at[0], e: Math.min(end, nextBlock(at[0])), items: e.items.map(x => x.txt), at, row0: 1 }); supp.push([at[0], end]); }
    else if (e.t === "statRouge" || e.t === "statBlanc" || e.t === "montant") { const end = Math.min(Math.max(nextSentStartAfter(e.i), s + 1.6), s + 3.5); ev.push({ ...e, s, e: end }); }
    else if (e.t === "highlight") { const end = E(e.iLast) + 0.25; ev.push({ t: "highlight", s, e: end, ws: S(e.iw), line: e.line, word: e.word }); supp.push([s, E(e.iLast) - 0.02]); }
    else if (e.t === "emoji") ev.push({ t: "emoji", s: S(e.i), e: Math.min(E(e.iEnd), S(e.i) + 3), txt: e.txt });
  }
  // transitions
  for (const t of starts) if (t > 0.5) ev.push({ t: "leak", s: Math.max(0, t - 0.2), e: t + 0.25 });
  ev.push({ t: "leak", s: Math.max(0, DUR - 0.45), e: DUR });
  // listes et blocs du haut : pas de chevauchement de liste avec les chiffres
  // sous-titres
  const MAXC = opt.maxChars ?? 24;
  const suppressed = t => supp.some(([a, b]) => t >= a - 1e-6 && t < b);
  const caps = [];
  for (const sidx of sents) {
    let cur = [];
    const txtOf = c => c.map(k => OW[k].w).filter(Boolean).join(" ");
    const flush = () => { if (cur.length) { const txt = txtOf(cur).replace(/^[,.\s]+|[,.;:\s]+$/g, ""); if (txt) caps.push({ txt, s: OW[cur[0]].os, e: OW[cur[cur.length - 1]].oe }); } cur = []; };
    for (const j of sidx) {
      const w = OW[j]; if (!w.w) continue;
      if (suppressed(w.os)) { flush(); continue; }
      const prevNum = cur.length && /^\d[\d\s,.]*$/.test(OW[cur[cur.length - 1]].w);
      if (cur.length && (txtOf(cur.concat(j)).length > MAXC || cur.length >= 4) && !prevNum) {
        let carry = [];
        if (cur.length > 1 && WEAK.has(norm(OW[cur[cur.length - 1]].w))) carry = [cur.pop()];
        flush(); cur = carry;
      }
      cur.push(j);
      if (/[,;:]$/.test(w.w) && cur.length >= 2) flush();
    }
    flush();
  }
  for (let k = 0; k < caps.length - 1; k++) caps[k].e = Math.min(caps[k + 1].s, caps[k].e + 0.6);
  if (caps.length) caps[caps.length - 1].e = Math.min(DUR, caps[caps.length - 1].e + 0.5);
  for (const c of caps) for (const [a] of supp) if (c.s < a && a < c.e) c.e = a;
  // zooms : alternance par phrase + recadrage serré sur les chiffres
  const zw = opt.zoomWide ?? 1, zt = opt.zoomTight ?? 1.14;
  const zoom = sents.map((x, k) => ({ s: k ? S(x[0]) : 0, z: k % 2 ? zt : zw }));
  for (const e of ev) if (["statRouge", "statBlanc", "montant"].includes(e.t)) zoom.push({ s: e.s, z: zt * 1.1, until: e.e });
  return { segs: out, dur: DUR, fps: FPS, caps: caps.filter(c => c.e - c.s > 0.05), ev, zoom, words: OW };
}

export function zoomAt(plan, t) {
  let z = plan.zoom.length ? plan.zoom[0].z : 1;
  for (const x of plan.zoom) if (!("until" in x) && t >= x.s) z = x.z;
  for (const x of plan.zoom) if ("until" in x && t >= x.s && t < x.until) z = x.z;
  return z;
}
export function srcTime(plan, t) {
  for (const [s, e, o] of plan.segs) if (t < o + (e - s) - 1e-9) return s + (t - o);
  const l = plan.segs[plan.segs.length - 1]; return l ? l[1] : 0;
}
