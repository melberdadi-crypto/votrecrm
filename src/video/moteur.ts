// Chargement de FFmpeg (version web) et étapes techniques du Studio vidéo, exécutées dans le navigateur.
import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { argumentsFFmpeg, DUREE_CARTON, HAUTEUR, IPS, LARGEUR, type Filtre, type Plage } from "./montage";

let instance: FFmpeg | null = null;

export async function chargerFFmpeg(onLog?: (m: string) => void) {
  if (instance) return instance;
  const ff = new FFmpeg();
  if (onLog) ff.on("log", ({ message }) => onLog(message));
  // Fichiers hébergés avec le CRM (même origine, mis en cache par le navigateur après la 1re fois)
  await ff.load({ coreURL: "/ffmpeg/ffmpeg-core.js", wasmURL: "/ffmpeg/ffmpeg-core.wasm" });
  await ff.createDir("/polices");
  await ff.writeFile("/polices/Poppins-Bold.ttf", await fetchFile("/fonts/Poppins-Bold.ttf"));
  instance = ff;
  return ff;
}

// La vidéo d'origine est « montée » sans être copiée en mémoire (important pour les gros fichiers)
async function monterEntree(ff: FFmpeg, fichier: File) {
  try { await ff.unmount("/entree"); } catch { /* rien à démonter */ }
  try { await ff.createDir("/entree"); } catch { /* existe déjà */ }
  await ff.mount(FFFSType.WORKERFS, { files: [fichier] }, "/entree");
  return `/entree/${fichier.name}`;
}

export async function extraireAudio(ff: FFmpeg, fichier: File): Promise<Blob> {
  const entree = await monterEntree(ff, fichier);
  await ff.exec(["-y", "-i", entree, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", "audio.mp3"]);
  const data = await ff.readFile("audio.mp3");
  await ff.deleteFile("audio.mp3");
  return new Blob([data as Uint8Array], { type: "audio/mpeg" });
}

// Carton de fin dessiné dans le navigateur : logo, nom, titre, agence, site
export async function dessinerCarton(): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = LARGEUR; canvas.height = HAUTEUR;
  const ctx = canvas.getContext("2d")!;
  const polices = [
    new FontFace("PoppinsCarton", "url(/fonts/Poppins-Medium.ttf)", { weight: "500" }),
    new FontFace("PoppinsCarton", "url(/fonts/Poppins-Regular.ttf)", { weight: "400" }),
  ];
  for (const p of polices) { await p.load(); document.fonts.add(p); }
  ctx.fillStyle = "#090808";
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  const logo = new Image();
  logo.src = "/logo-me.jpg";
  await logo.decode();
  ctx.globalCompositeOperation = "lighten"; // le fond noir du logo se fond dans le carton
  ctx.drawImage(logo, 60, 250, 600, 600);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#C8A97E";
  ctx.fillRect(310, 790, 100, 3);
  ctx.textAlign = "center";
  const ligne = (t: string, y: number, taille: number, poids: number, couleur: string) => {
    ctx.font = `${poids} ${taille}px PoppinsCarton`;
    ctx.fillStyle = couleur;
    ctx.fillText(t, LARGEUR / 2, y);
  };
  ligne("Mohamed El Berhdadi", 870, 46, 500, "#F4EFE6");
  ligne("Courtier immobilier résidentiel", 925, 28, 400, "#A8A29A");
  ligne("Vendirect inc.", 965, 28, 400, "#A8A29A");
  ligne("mohamedelberhdadi.ca", 1035, 28, 400, "#C8A97E");
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

// Carte d'introduction dessinée dans le navigateur : titre, prix, lieu de la propriété
function retourALaLigne(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, largeurMax: number, interligne: number) {
  const mots = texte.split(/\s+/);
  let ligne = "";
  const lignes: string[] = [];
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ctx.measureText(essai).width > largeurMax && ligne) { lignes.push(ligne); ligne = mot; }
    else ligne = essai;
  }
  if (ligne) lignes.push(ligne);
  const depart = y - ((lignes.length - 1) * interligne) / 2;
  lignes.forEach((l, i) => ctx.fillText(l, x, depart + i * interligne));
}

export async function dessinerIntroPropriete(titre: string, prix: string, lieu: string): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = LARGEUR; canvas.height = HAUTEUR;
  const ctx = canvas.getContext("2d")!;
  const polices = [
    new FontFace("PoppinsIntro", "url(/fonts/Poppins-Bold.ttf)", { weight: "700" }),
    new FontFace("PoppinsIntro", "url(/fonts/Poppins-Medium.ttf)", { weight: "500" }),
  ];
  for (const p of polices) { await p.load(); document.fonts.add(p); }
  const degrade = ctx.createLinearGradient(0, 0, 0, HAUTEUR);
  degrade.addColorStop(0, "#1a1512");
  degrade.addColorStop(1, "#090808");
  ctx.fillStyle = degrade;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  ctx.fillStyle = "#C8A97E";
  ctx.fillRect(LARGEUR / 2 - 50, HAUTEUR / 2 - 150, 100, 3);
  ctx.textAlign = "center";
  ctx.fillStyle = "#F4EFE6";
  ctx.font = "700 52px PoppinsIntro";
  retourALaLigne(ctx, titre || "Nouvelle propriété", LARGEUR / 2, HAUTEUR / 2 - 60, LARGEUR - 120, 62);
  ctx.fillStyle = "#C8A97E";
  ctx.font = "700 44px PoppinsIntro";
  ctx.fillText(prix || "Prix sur demande", LARGEUR / 2, HAUTEUR / 2 + 70);
  ctx.fillStyle = "#A8A29A";
  ctx.font = "500 28px PoppinsIntro";
  ctx.fillText(lieu || "", LARGEUR / 2, HAUTEUR / 2 + 115);
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

// Génère une vidéo « Reel » (Ken Burns) à partir de photos de propriété : carte de titre,
// zoom lent sur chaque photo, carton de fin (branding), musique de fond optionnelle.
export async function genererVideoPhotos(
  ff: FFmpeg,
  o: { photos: File[]; titre: string; prix: string; lieu: string; musique?: File | null; volumeMusique?: number; dureeParPhoto?: number },
  onProgres: (ratio: number) => void,
): Promise<Blob> {
  const fps = IPS;
  const duree = o.dureeParPhoto ?? 2.6;
  const dureeIntro = 2.2;
  const n = o.photos.length;
  const encodage = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p"];
  const clips: string[] = [];

  await ff.writeFile("intro.png", await dessinerIntroPropriete(o.titre, o.prix, o.lieu));
  await ff.exec([
    "-y", "-loop", "1", "-framerate", String(fps), "-t", String(dureeIntro), "-i", "intro.png",
    "-vf", `scale=${LARGEUR}:${HAUTEUR},setsar=1,zoompan=z='min(zoom+0.0015,1.06)':d=${Math.round(dureeIntro * fps)}:s=${LARGEUR}x${HAUTEUR}:fps=${fps},format=yuv420p`,
    ...encodage, "clip_intro.mp4",
  ]);
  clips.push("clip_intro.mp4");
  onProgres(0.08);

  for (let i = 0; i < n; i++) {
    const nomPhoto = `photo${i}.jpg`;
    await ff.writeFile(nomPhoto, await fetchFile(o.photos[i]));
    const zoomIn = i % 2 === 0;
    const zExpr = zoomIn ? "min(zoom+0.0012,1.15)" : "if(eq(on,0),1.15,max(zoom-0.0012,1.0))";
    await ff.exec([
      "-y", "-loop", "1", "-framerate", String(fps), "-t", String(duree), "-i", nomPhoto,
      "-vf", `scale=${Math.round(LARGEUR * 1.2)}:${Math.round(HAUTEUR * 1.2)}:force_original_aspect_ratio=increase,crop=${Math.round(LARGEUR * 1.2)}:${Math.round(HAUTEUR * 1.2)},zoompan=z='${zExpr}':d=${Math.round(duree * fps)}:s=${LARGEUR}x${HAUTEUR}:fps=${fps},format=yuv420p`,
      ...encodage, `clip${i}.mp4`,
    ]);
    await ff.deleteFile(nomPhoto);
    clips.push(`clip${i}.mp4`);
    onProgres(0.08 + ((i + 1) / n) * 0.72);
  }

  await ff.writeFile("carton.png", await dessinerCarton());
  await ff.exec([
    "-y", "-loop", "1", "-framerate", String(fps), "-t", String(DUREE_CARTON), "-i", "carton.png",
    "-vf", `scale=${LARGEUR}:${HAUTEUR},setsar=1,fade=t=in:st=0:d=0.4,format=yuv420p`,
    ...encodage, "clip_outro.mp4",
  ]);
  clips.push("clip_outro.mp4");
  onProgres(0.85);

  const liste = clips.map((c) => `file '${c}'`).join("\n");
  await ff.writeFile("liste.txt", new TextEncoder().encode(liste));
  await ff.exec(["-y", "-f", "concat", "-safe", "0", "-i", "liste.txt", "-c", "copy", "muet.mp4"]);

  let fichierFinal = "muet.mp4";
  if (o.musique) {
    await ff.writeFile("musique", await fetchFile(o.musique));
    const total = dureeIntro + n * duree + DUREE_CARTON;
    const vol = o.volumeMusique ?? 0.45;
    await ff.exec([
      "-y", "-i", "muet.mp4", "-stream_loop", "-1", "-i", "musique",
      "-filter_complex", `[1:a]aresample=48000,volume=${vol},atrim=0:${total.toFixed(2)},afade=t=out:st=${Math.max(0, total - 2).toFixed(2)}:d=2[a]`,
      "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", "sortie.mp4",
    ]);
    fichierFinal = "sortie.mp4";
  }

  const data = await ff.readFile(fichierFinal);
  const blob = new Blob([data as Uint8Array], { type: "video/mp4" });
  onProgres(1);

  for (const c of [...clips, "muet.mp4", "sortie.mp4", "liste.txt", "intro.png", "carton.png"]) {
    try { await ff.deleteFile(c); } catch { /* déjà absent */ }
  }
  return blob;
}

export async function monterVideo(
  ff: FFmpeg,
  o: {
    fichier: File; plages: Plage[]; ass: string | null; carton: boolean; musique?: File | null; volumeMusique: number;
    filtre: Filtre; zooms: Plage[]; sonStudio: boolean;
  },
  onProgres: (ratio: number) => void,
): Promise<Blob> {
  const entree = await monterEntree(ff, o.fichier);
  if (o.ass) await ff.writeFile("sous-titres.ass", new TextEncoder().encode(o.ass));
  if (o.carton) await ff.writeFile("carton.png", await dessinerCarton());
  if (o.musique) await ff.writeFile("musique", await fetchFile(o.musique));

  const suivi = ({ progress }: { progress: number }) => onProgres(Math.max(0, Math.min(1, progress)));
  ff.on("progress", suivi);
  try {
    const args = argumentsFFmpeg({
      entree, sortie: "sortie.mp4", plages: o.plages, sousTitres: Boolean(o.ass), carton: o.carton,
      musique: o.musique ? "musique" : undefined, volumeMusique: o.volumeMusique,
      filtre: o.filtre, zooms: o.zooms, sonStudio: o.sonStudio,
    });
    const code = await ff.exec(args);
    if (code !== 0) throw new Error("Le montage a échoué (code " + code + ").");
    const data = await ff.readFile("sortie.mp4");
    await ff.deleteFile("sortie.mp4");
    return new Blob([data as Uint8Array], { type: "video/mp4" });
  } finally {
    ff.off("progress", suivi);
  }
}
