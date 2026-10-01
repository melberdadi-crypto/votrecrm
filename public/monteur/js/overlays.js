// Dessin des textes animés dans le style de la vidéo de référence (canvas 1080×1920).
export const W = 1080, H = 1920, CAPY = 1400;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const back = x => { x = clamp(x, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const EMOJI = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";

export const FONT_FACES = ["700 40px Poppins", "800 40px Poppins", "600 40px Poppins", "400 40px Anton", "600 40px Montserrat", "800 40px Montserrat", "italic 300 40px Montserrat", "900 40px Playfair", "600 40px Oswald"];
export async function ensureFonts() {
  await Promise.all(FONT_FACES.map(f => document.fonts.load(f).catch(() => null)));
  const missing = FONT_FACES.filter(f => !document.fonts.check(f));
  if (missing.length) throw new Error("Polices non chargées : " + missing.join(", "));
}

function LS(ctx, px) { if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px"; }
function sh(ctx, b, a, oy) { ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = b; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = oy || 0; }
function ns(ctx) { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
function fit(ctx, font, size, text, maxW) { let s = size; do { ctx.font = font.replace("{s}", s); if (ctx.measureText(text).width <= maxW) break; s -= 4; } while (s > 20); return s; }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function outlined(ctx, text, x, y, lw) { ctx.lineJoin = "round"; ctx.lineWidth = lw; ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.strokeText(text, x, y); ns(ctx); ctx.fillStyle = "#fff"; ctx.fillText(text, x, y); }

function caption(ctx, c, t) {
  ctx.save(); ctx.globalAlpha = ease((t - c.s) / 0.1);
  const sc = 0.9 + 0.1 * back((t - c.s) / 0.12);
  ctx.translate(540, CAPY); ctx.scale(sc, sc); ctx.textAlign = "center"; LS(ctx, -3);
  fit(ctx, "700 {s}px Poppins", 70, c.txt, 960); sh(ctx, 26, .8, 4); outlined(ctx, c.txt, 0, 22, 8);
  ctx.restore();
}
function chip(ctx, text, x, y, prog, o = {}) {
  const n = Math.round(text.length * clamp(prog, 0, 1)); if (n <= 0) return;
  const s = text.slice(0, n); ctx.save(); ctx.font = o.font || "600 44px Poppins"; LS(ctx, 0);
  let w = ctx.measureText(s).width; const maxW = 940; let sc = 1; if (w > maxW) { sc = maxW / w; }
  ns(ctx); ctx.fillStyle = o.bg || "#fff"; ctx.fillRect(x, y, w * sc + 30, o.h || 64);
  ctx.fillStyle = o.fg || "#7A1410"; ctx.textAlign = "left"; ctx.translate(x + 15, y + (o.base || 47)); ctx.scale(sc, 1); ctx.fillText(s, 0, 0); ctx.restore();
}
function inOut(t, e, d = 0.08) { return ease((t - e.s) / d) * (1 - ease((t - (e.e - 0.1)) / 0.1)); }

function drawEvent(ctx, e, t) {
  const p = t - e.s;
  switch (e.t) {
    case "statRouge": { ctx.save(); const k = back(p / 0.18); ctx.globalAlpha = inOut(t, e); ctx.translate(540, 500); ctx.scale(1.25 - .25 * k, 1.25 - .25 * k);
      ctx.textAlign = "center"; LS(ctx, 2); fit(ctx, "400 {s}px Anton", 230, e.main, 980); sh(ctx, 24, .45, 6); ctx.fillStyle = "#E93D25"; ctx.fillText(e.main, 0, 0); ctx.restore(); break; }
    case "statBlanc": { ctx.save(); const k = back(p / 0.18); ctx.globalAlpha = inOut(t, e); ctx.translate(540, 470); ctx.scale(1.2 - .2 * k, 1.2 - .2 * k); ctx.textAlign = "center"; LS(ctx, -6);
      fit(ctx, "800 {s}px Poppins", 210, e.main, 900); sh(ctx, 20, .45, 4); ctx.fillStyle = "#fff"; ctx.fillText(e.main, 0, 0);
      if (e.sub) { LS(ctx, 0); fit(ctx, "italic 300 {s}px Montserrat", 56, e.sub, 900); ctx.fillText(e.sub, 0, 75); } ctx.restore(); break; }
    case "montant": { ctx.save(); const k = back(p / 0.2); ctx.globalAlpha = inOut(t, e); ctx.translate(540, 480); ctx.scale(1.2 - .2 * k, 1.2 - .2 * k); ctx.textAlign = "left"; LS(ctx, 0);
      const s = fit(ctx, "900 {s}px Playfair", 200, e.main, 900); const w = ctx.measureText(e.main).width, x = -w / 2;
      const g = ctx.createLinearGradient(0, -s * .75, 0, 0); g.addColorStop(0, "#FFFFFF"); g.addColorStop(1, "#BDBDBD"); sh(ctx, 22, .5, 6); ctx.fillStyle = g; ctx.fillText(e.main, x, 0);
      ctx.fillStyle = "#fff"; ctx.font = "600 44px Oswald"; if (e.top) { ctx.textAlign = "left"; ctx.fillText(e.top, x + 6, -s * .8); } if (e.sub) { ctx.textAlign = "right"; ctx.fillText(e.sub, x + w, 58); } ctx.restore(); break; }
    case "emoji": { if (!e.txt) break; ctx.save(); const k = back(p / 0.2); ctx.translate(540, CAPY + 110); ctx.scale(k, k); ctx.font = "90px " + EMOJI; ctx.textAlign = "center"; ctx.fillText(e.txt, 0, 30); ctx.restore(); break; }
    case "section": chip(ctx, e.txt, 60, 250, p / 0.35, { bg: "#B61D0A", fg: "#fff", font: "700 46px Poppins" }); break;
    case "list": e.items.forEach((it, i) => { const q = t - e.at[i]; if (q >= 0) chip(ctx, it, 60, 250 + (i + (e.row0 ?? 1)) * 96, q / 0.3); }); break;
    case "name": e.lines.forEach((l, i) => { const q = p - i * 0.25; if (q >= 0) chip(ctx, l, 60, 250 + i * 96, q / 0.4, i === 0 ? { font: "800 50px Poppins", h: 70, base: 52, bg: "#B61D0A", fg: "#fff" } : {}); }); break;
    case "highlight": { ctx.save(); ctx.globalAlpha = ease(p / 0.12); ctx.textAlign = "left"; LS(ctx, 0);
      if (e.line) { fit(ctx, "600 {s}px Montserrat", 50, e.line, 940); sh(ctx, 22, .8, 3); outlined(ctx, e.line, 64, CAPY - 10, 7); } ctx.restore();
      const q = t - e.ws; if (q >= 0) { ctx.save(); LS(ctx, -1); const fs = fit(ctx, "800 {s}px Poppins", 64, e.word, 900); const w = ctx.measureText(e.word).width; const x = Math.max(64, 1000 - w - 28); const wipe = ease(q / 0.15);
        ns(ctx); ctx.fillStyle = "#B61D0A"; ctx.fillRect(x, CAPY + 18, (w + 28) * wipe, 84); ctx.beginPath(); ctx.rect(x, CAPY + 18, (w + 28) * wipe, 84); ctx.clip(); ctx.fillStyle = "#fff"; ctx.fillText(e.word, x + 14, CAPY + 60 + fs * 0.36); ctx.restore(); } break; }
    case "cta": { ctx.save(); const k = back(p / 0.25); ctx.font = "800 60px Montserrat"; LS(ctx, -1); ctx.textAlign = "center";
      const lines = e.lines.filter(Boolean); if (!lines.length) { ctx.restore(); break; }
      let lw = Math.max(...lines.map(l => ctx.measureText(l).width)); const sc = lw > 900 ? 900 / lw : 1; lw *= sc;
      const lh = 70, pw = lw + 80, ph = lines.length * lh + 56, cx = 540, y = 250;
      ctx.translate(cx, y + ph); ctx.scale(k, k); ctx.translate(-cx, -(y + ph)); sh(ctx, 30, .3, 8); ctx.fillStyle = "#fff"; rr(ctx, cx - pw / 2, y, pw, ph, 32); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 34, y + ph - 2); ctx.lineTo(cx + 6, y + ph + 44); ctx.lineTo(cx + 26, y + ph - 2); ctx.closePath(); ctx.fill(); ns(ctx);
      lines.forEach((l, i) => { ctx.save(); ctx.translate(cx, y + 28 + lh * (i + 1) - 14); ctx.scale(sc, 1); ctx.fillStyle = (lines.length === 3 && i === 1) ? "#B61D0A" : "#111"; ctx.fillText(l, 0, 0); ctx.restore(); });
      ctx.restore(); break; }
    case "leak": { const d = e.e - e.s, q = p / d; const a = Math.sin(Math.PI * clamp(q, 0, 1)); ctx.save(); const x = -200 + q * 1500;
      [[x, 500, 900, "255,170,60"], [x - 300, 1300, 1100, "255,90,30"], [x + 200, 900, 700, "255,235,170"]].forEach(([gx, gy, r, c]) => { const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, `rgba(${c},${.95 * a})`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); });
      ctx.fillStyle = `rgba(255,230,190,${.45 * a})`; ctx.fillRect(0, 0, W, H); ctx.restore(); break; }
  }
}

export function drawOverlays(ctx, plan, t) {
  for (const c of plan.caps) if (t >= c.s && t < c.e) caption(ctx, c, t);
  const order = ["emoji", "highlight", "statRouge", "statBlanc", "montant", "section", "list", "name", "cta", "leak"];
  const ev = plan.ev.filter(e => t >= e.s && t < e.e).sort((a, b) => order.indexOf(a.t) - order.indexOf(b.t));
  for (const e of ev) drawEvent(ctx, e, t);
}
