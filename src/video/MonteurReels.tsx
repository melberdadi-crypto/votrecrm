import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Monteur Reels : application autonome servie depuis /public/monteur (même origine que le CRM).
// Tout le montage (transcription, recadrage, textes animés, son, export MP4) se fait dans le
// navigateur : aucun serveur, aucune fonction Netlify, aucuns frais. La vidéo finie est
// renvoyée au CRM par postMessage quand l'utilisateur clique « Enregistrer dans le CRM ».

type Props = {
  onVideo?: (blob: Blob, nom: string) => Promise<void>;
  height?: string;
};

type MessageMonteur = { type?: string; blob?: unknown; name?: unknown };

export function MonteurReels({ onVideo, height = "calc(100vh - 190px)" }: Props) {
  const cadre = useRef<HTMLIFrameElement>(null);
  const rappel = useRef(onVideo);
  rappel.current = onVideo;

  useEffect(() => {
    const surMessage = async (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin || ev.source !== cadre.current?.contentWindow) return;
      const donnees = ev.data as MessageMonteur | null;
      if (!donnees || donnees.type !== "monteur:video" || !(donnees.blob instanceof Blob)) return;
      const repondre = (msg: Record<string, string>) => cadre.current?.contentWindow?.postMessage(msg, window.location.origin);
      const enregistrer = rappel.current;
      if (!enregistrer) {
        repondre({ type: "monteur:error", message: "Enregistrement indisponible ici, téléchargez la vidéo" });
        return;
      }
      try {
        await enregistrer(donnees.blob, typeof donnees.name === "string" ? donnees.name : "reel.mp4");
        repondre({ type: "monteur:saved" });
      } catch (e) {
        repondre({ type: "monteur:error", message: e instanceof Error ? e.message : "erreur inconnue" });
      }
    };
    window.addEventListener("message", surMessage);
    return () => window.removeEventListener("message", surMessage);
  }, []);

  return (
    <iframe
      ref={cadre}
      src={`/monteur/index.html?embed=1${onVideo ? "&save=1" : ""}`}
      title="Monteur Reels"
      style={{ width: "100%", height, minHeight: 620, border: 0, borderRadius: 12, background: "transparent", display: "block" }}
    />
  );
}

// Fenêtre plein écran contenant le monteur (utilisée depuis la fiche d'une propriété).
export function FenetreMonteur({ onClose, onVideo }: { onClose: () => void; onVideo: (blob: Blob, nom: string) => Promise<void> }) {
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [onClose]);
  return createPortal(
    <div className="modal-layer" style={{ zIndex: 80, padding: "2vh 10px" }} role="dialog" aria-modal="true" aria-label="Monteur Reels">
      <div style={{ width: "min(1400px, 100%)", background: "var(--surface, #fff)", borderRadius: 14, padding: 10, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button type="button" className="trash-action" onClick={onClose}><X size={14} /> Fermer le monteur</button>
        </div>
        <MonteurReels onVideo={onVideo} height="calc(96vh - 70px)" />
      </div>
    </div>,
    document.body,
  );
}
