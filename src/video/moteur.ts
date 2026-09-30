// Chargement de FFmpeg (version web) et étapes techniques du Studio vidéo, exécutées dans le navigateur.
import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { argumentsFFmpeg, HAUTEUR, LARGEUR, type Filtre, type Plage } from "./montage";

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
