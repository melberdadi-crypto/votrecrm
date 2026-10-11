import { Image, TextLayout } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

// Polices Google Fonts (licence SIL OFL) : DM Serif Display pour les titres, Poppins pour le texte
const FONTS = {
  serif: "https://raw.githubusercontent.com/google/fonts/main/ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf",
  sans: "https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Medium.ttf",
};
let cache: { serif: Uint8Array; sans: Uint8Array } | null = null;
async function polices() {
  if (cache) return cache;
  const [serif, sans] = await Promise.all(Object.values(FONTS).map(async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Police introuvable (${res.status}) : ${url}`);
    return new Uint8Array(await res.arrayBuffer());
  }));
  cache = { serif, sans };
  return cache;
}

const W = 1080, H = 1350;
const INK = 0x101010ff, GOLD = 0xc8a97eff, IVORY = 0xf4efe6ff, MUTED = 0xa8a29aff, LINE = 0x3a3733ff;

// Visuel 4:5 aux couleurs du site : fond noir, cadre et accents or, titre ivoire.
// `role` : ligne sous le nom (titre professionnel au Québec, numéro marocain pour le Maroc).
export async function renderVisuel(opts: { kicker: string; titre: string; sousTitre?: string; role?: string }): Promise<Uint8Array> {
  const { serif, sans } = await polices();
  const img = new Image(W, H).fill(INK);
  const x = 60, y = 60, w = W - 120, h = H - 120;
  img.drawBox(x, y, w, 2, GOLD);
  img.drawBox(x, y + h - 2, w, 2, GOLD);
  img.drawBox(x, y, 2, h, GOLD);
  img.drawBox(x + w - 2, y, 2, h, GOLD);

  const kicker = await Image.renderText(sans, 26, opts.kicker.toUpperCase().split("").join(" "), GOLD);
  img.composite(kicker, 130, 170);
  img.drawBox(130, 230, 90, 3, GOLD);

  const len = opts.titre.length;
  const size = len > 70 ? 70 : len > 45 ? 82 : 96;
  const titre = await Image.renderText(serif, size, opts.titre, IVORY, new TextLayout({ maxWidth: W - 260, wrapStyle: "word" }));
  img.composite(titre, 130, 290);

  if (opts.sousTitre) {
    const st = await Image.renderText(sans, 34, opts.sousTitre, MUTED, new TextLayout({ maxWidth: W - 260, wrapStyle: "word" }));
    img.composite(st, 130, Math.min(290 + titre.height + 50, H - 300 - st.height));
  }

  img.drawBox(130, H - 260, W - 260, 1, LINE);
  const nom = await Image.renderText(serif, 40, "Mohamed El Berhdadi", IVORY);
  img.composite(nom, 130, H - 232);
  const url = await Image.renderText(sans, 22, "mohamedelberhdadi.ca", GOLD);
  img.composite(url, W - 130 - url.width, H - 218);
  const role = await Image.renderText(sans, 22, opts.role || "Courtier immobilier résidentiel · Vendirect inc.", MUTED);
  img.composite(role, 130, H - 170);

  return await img.encodeJPEG(88);
}
