// Moteur de montage du Studio vidéo : à partir de la transcription mot à mot,
// calcule les passages à garder (coupe des silences), les sous-titres animés (format ASS)
// et la commande FFmpeg complète (sous-titres + carton de fin + musique avec atténuation automatique).

export type MotBrut = { mot: string; debut: number; fin: number };
export type Segment = { texte: string; debut: number; fin: number };
export type Mot = { texte: string; debut: number; fin: number; cle?: boolean };
export type Plage = { debut: number; fin: number };
export type Bloc = { mots: Mot[] };

export const LARGEUR = 720;
export const HAUTEUR = 1280;
export const IPS = 30;
export const DUREE_CARTON = 3;
export const DUREE_ACCROCHE = 2.8;

export type StyleSousTitres = "or" | "boite" | "karaoke" | "impact";
export type Filtre = "naturel" | "lumineux" | "chaleureux" | "luxe" | "jaune";

export const STYLES: { id: StyleSousTitres; nom: string }[] = [
  { id: "or", nom: "Or" },
  { id: "boite", nom: "Boîte" },
  { id: "karaoke", nom: "Karaoké" },
  { id: "impact", nom: "Impact" },
];
export const FILTRES: { id: Filtre; nom: string; ffmpeg: string }[] = [
  { id: "naturel", nom: "Naturel", ffmpeg: "" },
  { id: "lumineux", nom: "Lumineux", ffmpeg: "eq=brightness=0.04:contrast=1.06:saturation=1.08" },
  { id: "chaleureux", nom: "Chaleureux", ffmpeg: "colorbalance=rs=0.05:gs=0.01:bs=-0.05:rm=0.03:bm=-0.03,eq=contrast=1.04:saturation=1.1" },
  { id: "luxe", nom: "Luxe", ffmpeg: "eq=contrast=1.12:saturation=0.88:brightness=-0.01,vignette=angle=PI/5" },
  { id: "jaune", nom: "Corriger lumière jaune", ffmpeg: "colorbalance=rs=-0.09:gs=-0.02:bs=0.11:rm=-0.07:bm=0.08,eq=brightness=0.035:contrast=1.06:saturation=0.93" },
];

// Remet la ponctuation et les traits d'union du texte des segments sur les mots horodatés
export function preparerMots(mots: MotBrut[], segments: Segment[]): Mot[] {
  const propres = mots.filter((m) => m.mot.trim());
  const texte = segments.map((s) => s.texte).join(" ");
  const bas = texte.toLowerCase();
  let curseur = 0;
  const res: Mot[] = [];
  for (const m of propres) {
    const cible = m.mot.trim();
    const pos = bas.indexOf(cible.toLowerCase(), curseur);
    if (pos === -1) { res.push({ texte: cible, debut: m.debut, fin: m.fin }); continue; }
    // Ponctuation entre le mot précédent et celui-ci : rattachée au mot précédent
    const entre = texte.slice(curseur, pos);
    const ponct = entre.replace(/\s+/g, "");
    if (res.length && ponct) res[res.length - 1].texte += ponctuation(ponct);
    res.push({ texte: texte.slice(pos, pos + cible.length), debut: m.debut, fin: m.fin });
    curseur = pos + cible.length;
  }
  const fin = texte.slice(curseur).replace(/\s+/g, "");
  if (res.length && fin) res[res.length - 1].texte += ponctuation(fin);
  return res;
}

// Typographie française : espace insécable avant ? ! : ;
const ponctuation = (p: string) => (/^[?!:;]/.test(p) ? "\u00a0" + p : p);

// Passages à garder : on supprime les pauses de plus de `pauseMax` secondes (silences, « euh »)
export function calculerPlages(mots: Mot[], duree: number, opts = { marge: 0.15, pauseMax: 0.6, couper: true }): Plage[] {
  if (!opts.couper || !mots.length) return [{ debut: 0, fin: duree }];
  const plages: Plage[] = [];
  let courante: Plage = { debut: Math.max(0, mots[0].debut - opts.marge), fin: mots[0].fin + opts.marge };
  for (const m of mots.slice(1)) {
    if (m.debut - courante.fin + opts.marge > opts.pauseMax) {
      plages.push(courante);
      courante = { debut: Math.max(0, m.debut - opts.marge), fin: m.fin + opts.marge };
    } else {
      courante.fin = m.fin + opts.marge;
    }
  }
  plages.push(courante);
  return plages.map((p) => ({ debut: arrondi(p.debut), fin: arrondi(Math.min(p.fin, duree)) })).filter((p) => p.fin - p.debut > 0.1);
}

// Convertit un temps de la vidéo d'origine en temps de la vidéo montée
export function tempsMonte(t: number, plages: Plage[]): number {
  let cumul = 0;
  for (const p of plages) {
    if (t < p.debut) return cumul;
    if (t <= p.fin) return cumul + (t - p.debut);
    cumul += p.fin - p.debut;
  }
  return cumul;
}

export const dureeMontee = (plages: Plage[]) => plages.reduce((s, p) => s + (p.fin - p.debut), 0);

// Regroupe les mots en blocs courts (3 mots max, ~22 caractères), coupés à la ponctuation
export function construireBlocs(mots: Mot[], maxMots = 3, maxCar = 16): Bloc[] {
  const blocs: Bloc[] = [];
  let courant: Mot[] = [];
  const longueur = (l: Mot[]) => l.map((m) => m.texte).join(" ").length;
  for (const m of mots) {
    if (courant.length && (courant.length >= maxMots || longueur([...courant, m]) > maxCar || m.debut - courant[courant.length - 1].fin > 0.5)) {
      blocs.push({ mots: courant });
      courant = [];
    }
    courant.push(m);
    if (/[.!?…,;:]$/.test(m.texte)) { blocs.push({ mots: courant }); courant = []; }
  }
  if (courant.length) blocs.push({ mots: courant });
  return blocs;
}

const temps = (s: number) => {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), sec = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
};
const echapper = (t: string) => t.replace(/\\/g, "").replace(/[{}]/g, "").replace(/\n/g, " ");

// Sous-titres style Reels, 4 styles, mots-clés agrandis en or, titre d'accroche en haut
export function genererASS(
  blocsEntree: Bloc[],
  plages: Plage[],
  opts: { majuscules?: boolean; style?: StyleSousTitres; accroche?: string } = {},
): string {
  const style = opts.style || "or";
  const OR = "&H007EA9C8&"; // #C8A97E en BGR
  const BLANC = "&H00FFFFFF&";
  const majuscules = opts.majuscules || style === "impact";
  // Le style « Impact » affiche 2 mots à la fois
  const blocs: Bloc[] = style === "impact"
    ? blocsEntree.flatMap((b) => { const r: Bloc[] = []; for (let i = 0; i < b.mots.length; i += 2) r.push({ mots: b.mots.slice(i, i + 2) }); return r; })
    : blocsEntree;

  const styles: Record<StyleSousTitres, string> = {
    or: "Style: Reel,Poppins,80,&H00FFFFFF,&H00FFFFFF,&H00101010,&H96000000,-1,0,0,0,100,100,0,0,1,6,3,2,40,40,380,1",
    karaoke: "Style: Reel,Poppins,80,&H00FFFFFF,&H00FFFFFF,&H00101010,&H96000000,-1,0,0,0,100,100,0,0,1,6,3,2,40,40,380,1",
    boite: "Style: Reel,Poppins,72,&H00FFFFFF,&H00FFFFFF,&H50101010,&H50101010,-1,0,0,0,100,100,0,0,3,14,0,2,40,40,380,1",
    impact: "Style: Reel,Poppins,100,&H00FFFFFF,&H00FFFFFF,&H00101010,&H96000000,-1,0,0,0,100,100,1,0,1,7,4,2,40,40,400,1",
  };
  const lignes = [
    "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${LARGEUR}`, `PlayResY: ${HAUTEUR}`, "WrapStyle: 0", "ScaledBorderAndShadow: yes", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    styles[style],
    "Style: Accroche,Poppins,72,&H00101010,&H00101010,&H007EA9C8,&H007EA9C8,-1,0,0,0,100,100,0,0,3,18,0,8,60,60,210,1",
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  if (opts.accroche?.trim()) {
    lignes.push(`Dialogue: 1,${temps(0.1)},${temps(DUREE_ACCROCHE)},Accroche,,0,0,0,,{\\fad(200,250)\\fscx90\\fscy90\\t(0,180,\\fscx100\\fscy100)}${echapper(opts.accroche.trim())}`);
  }
  const dureeTotale = dureeMontee(plages);
  blocs.forEach((bloc, i) => {
    const debutBloc = tempsMonte(bloc.mots[0].debut, plages);
    const suivant = blocs[i + 1];
    const finBloc = Math.min(
      tempsMonte(bloc.mots[bloc.mots.length - 1].fin, plages) + 0.25,
      suivant ? tempsMonte(suivant.mots[0].debut, plages) : dureeTotale,
    );
    bloc.mots.forEach((mot, j) => {
      const debut = j === 0 ? debutBloc : tempsMonte(mot.debut, plages);
      const fin = j < bloc.mots.length - 1 ? tempsMonte(bloc.mots[j + 1].debut, plages) : finBloc;
      if (fin - debut < 0.02) return;
      const texte = bloc.mots.map((m, k) => {
        const t = echapper(majuscules ? m.texte.toUpperCase() : m.texte);
        const sep = k === 0 || /[-'’]$/.test(bloc.mots[k - 1].texte) ? "" : " ";
        const actif = k === j;
        const dore = actif || m.cle || (style === "karaoke" && k < j);
        const taille = m.cle ? (actif ? 125 : 115) : actif && style === "impact" ? 110 : 100;
        const balises = (dore ? `\\c${OR}` : "") + (taille !== 100 ? `\\fscx${taille}\\fscy${taille}` : "");
        return sep + (balises ? `{${balises}}${t}{\\c${BLANC}\\fscx100\\fscy100}` : t);
      }).join("");
      const pop = j === 0 ? "{\\fscx85\\fscy85\\t(0,90,\\fscx100\\fscy100)}" : "";
      lignes.push(`Dialogue: 0,${temps(debut)},${temps(fin)},Reel,,0,0,0,,${pop}${texte}`);
    });
  });
  return lignes.join("\n") + "\n";
}

// Fenêtres de zoom (temps de la vidéo montée) : zoom net au début d'une phrase forte, maintenu ~2,5 s
export function fenetresZoom(tempsSource: number[], plages: Plage[], duree = 2.5): Plage[] {
  const total = dureeMontee(plages);
  const debuts = tempsSource.map((t) => tempsMonte(t, plages)).sort((x, y) => x - y);
  const res: Plage[] = [];
  for (const d of debuts) {
    if (res.length && d < res[res.length - 1].fin + 1.5) continue; // pas de zooms collés
    res.push({ debut: arrondi(d), fin: arrondi(Math.min(d + duree, total)) });
  }
  return res.filter((p) => p.fin - p.debut > 0.5);
}

const arrondi = (n: number) => Math.round(n * 1000) / 1000;

// Commande FFmpeg complète. Fichiers attendus dans le système de fichiers de FFmpeg :
// entree (vidéo), sous-titres.ass, carton.png, polices dans /polices, musique (optionnelle)
export function argumentsFFmpeg(o: {
  entree: string; sortie: string; plages: Plage[]; sousTitres: boolean; carton: boolean; musique?: string; volumeMusique?: number;
  filtre?: Filtre; zooms?: Plage[]; niveauZoom?: number; sonStudio?: boolean;
}): string[] {
  const sel = o.plages.map((p) => `between(t\\,${p.debut}\\,${p.fin})`).join("+");
  const total = dureeMontee(o.plages) + (o.carton ? DUREE_CARTON : 0);
  const args = ["-y", "-i", o.entree];
  if (o.carton) args.push("-loop", "1", "-framerate", String(IPS), "-t", String(DUREE_CARTON), "-i", "carton.png");
  if (o.musique) args.push("-stream_loop", "-1", "-i", o.musique);
  const idxMusique = o.carton ? 2 : 1;

  const f: string[] = [];
  const couleur = FILTRES.find((x) => x.id === o.filtre)?.ffmpeg;
  const zooms = o.zooms || [];
  const base =
    `[0:v]fps=${IPS},scale=${LARGEUR}:${HAUTEUR}:force_original_aspect_ratio=increase,crop=${LARGEUR}:${HAUTEUR},setsar=1,` +
    `select='${sel}',setpts=N/${IPS}/TB${couleur ? "," + couleur : ""}`;
  const soustitres = o.sousTitres ? "ass=sous-titres.ass:fontsdir=/polices," : "";
  if (zooms.length) {
    // Zoom net (« jump cut ») : une copie recadrée se superpose pendant les fenêtres choisies
    const z = o.niveauZoom ?? 1.12;
    const lz = Math.round(LARGEUR / z / 2) * 2, hz = Math.round(HAUTEUR / z / 2) * 2;
    const quand = zooms.map((p) => `between(t\\,${p.debut}\\,${p.fin})`).join("+");
    f.push(`${base},split=2[vbase][vzsrc]`);
    f.push(`[vzsrc]crop=${lz}:${hz}:(iw-${lz})/2:(ih-${hz})/2.4,scale=${LARGEUR}:${HAUTEUR}[vzoom]`);
    f.push(`[vbase][vzoom]overlay=0:0:enable='${quand}',${soustitres}format=yuv420p[vp]`);
  } else {
    f.push(`${base},${soustitres}format=yuv420p[vp]`);
  }
  const voix = o.sonStudio
    ? "highpass=f=80,afftdn=nf=-25,acompressor=threshold=0.08:ratio=3.5:attack=5:release=120:makeup=1.5,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000"
    : "highpass=f=80,acompressor=threshold=0.1:ratio=3:attack=5:release=120:makeup=1.6";
  f.push(
    `[0:a]aresample=48000,aselect='${sel}',asetpts=N/SR/TB,${voix},aformat=sample_fmts=fltp:channel_layouts=stereo[ap]`,
  );
  let v = "[vp]", a = "[ap]";
  if (o.carton) {
    f.push(`[1:v]scale=${LARGEUR}:${HAUTEUR},setsar=1,fps=${IPS},format=yuv420p,fade=t=in:st=0:d=0.4[vc]`);
    f.push(`aevalsrc=0:d=${DUREE_CARTON}:s=48000:c=stereo,aformat=sample_fmts=fltp:channel_layouts=stereo[ac]`);
    f.push(`[vp][ap][vc][ac]concat=n=2:v=1:a=1[vt][at]`);
    v = "[vt]"; a = "[at]";
  }
  if (o.musique) {
    const vol = o.volumeMusique ?? 0.22;
    f.push(`[${idxMusique}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${vol},atrim=0:${total.toFixed(2)},afade=t=out:st=${Math.max(0, total - 2).toFixed(2)}:d=2[mus]`);
    f.push(`${a}asplit=2[voix][guide]`);
    f.push(`[mus][guide]sidechaincompress=threshold=0.02:ratio=12:attack=20:release=450[musatt]`);
    f.push(`[voix][musatt]amix=inputs=2:duration=first:normalize=0[am]`);
    a = "[am]";
  }
  args.push("-filter_complex", f.join(";"), "-map", v, "-map", a);
  args.push(
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-maxrate", "2M", "-bufsize", "4M", "-pix_fmt", "yuv420p", "-r", String(IPS),
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-movflags", "+faststart", "-t", total.toFixed(2), o.sortie,
  );
  return args;
}
