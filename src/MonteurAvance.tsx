import { useEffect, useRef, useState } from "react";
import { Clapperboard, CheckCircle2, UploadCloud } from "lucide-react";
import { televerserVideoBrute } from "./lib/storage";
import { creerJobVideo, lireJobVideo, validerJobVideo, LIBELLES_EVENEMENTS, type VideoJobRow } from "./lib/videoJobs";

// Panneau "Reel avancé" : on téléverse une vraie vidéo filmée, elle est montée
// automatiquement (sous-titres animés, chiffres, listes, appel à l'action...)
// par le monteur qui tourne sur l'ordinateur de Mohamed. On valide la
// transcription avant le rendu final, puis on récupère la vidéo montée.
export default function MonteurAvance({ organizationId, propertyId, onVideoPrete }: { organizationId: string | null; propertyId: string | null; onVideoPrete: (url: string) => void }) {
  const [job, setJob] = useState<VideoJobRow | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const minuteurRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!job || job.statut === "termine" || job.statut === "erreur") {
      if (minuteurRef.current) clearInterval(minuteurRef.current);
      return;
    }
    minuteurRef.current = setInterval(async () => {
      try {
        const frais = await lireJobVideo(job.id);
        if (frais) setJob(frais);
      } catch { /* ignore, on réessaie au prochain tour */ }
    }, 5000);
    return () => { if (minuteurRef.current) clearInterval(minuteurRef.current); };
  }, [job]);

  useEffect(() => {
    if (job?.statut === "termine" && job.video_finale_url) onVideoPrete(job.video_finale_url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.statut]);

  async function surDepot(fichier: File | null) {
    if (!fichier || !organizationId) return;
    setEnvoi(true);
    setErreur("");
    try {
      const chemin = await televerserVideoBrute(organizationId, fichier);
      const nouveauJob = await creerJobVideo(organizationId, propertyId, chemin);
      setJob(nouveauJob);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'envoi a échoué.");
    } finally {
      setEnvoi(false);
    }
  }

  if (!organizationId) return null;

  return (
    <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 10 }}>
      <label className="consent" style={{ marginBottom: 8 }}>
        <span><Clapperboard size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />Reel avancé à partir d'une vraie vidéo filmée</span>
      </label>
      <p className="settings-note" style={{ marginTop: -4, marginBottom: 8 }}>
        Sous-titres animés, chiffres et listes mis en valeur, appel à l'action — monté automatiquement sur ton ordinateur (laisse-le allumé pendant le montage, 5 à 10 minutes).
      </p>

      {!job && (
        <label className="trash-action" style={{ cursor: "pointer", display: "inline-flex" }}>
          <UploadCloud size={13} /> {envoi ? "Envoi…" : "Téléverser la vidéo brute"}
          <input type="file" accept="video/*" style={{ display: "none" }} disabled={envoi} onChange={(e) => surDepot(e.target.files?.[0] ?? null)} />
        </label>
      )}
      {erreur && <p className="result-count" style={{ color: "#B91C1C" }}>{erreur}</p>}

      {job && job.statut !== "en_validation" && job.statut !== "termine" && job.statut !== "erreur" && (
        <p className="result-count">
          {job.statut === "nouveau" && "En attente — le monteur sur l'ordinateur de Mohamed va bientôt commencer…"}
          {job.statut === "en_cours" && "Transcription et analyse en cours…"}
          {job.statut === "valide" && "Validé — rendu final en cours (peut prendre plusieurs minutes)…"}
          {job.statut === "rendu" && "Rendu final en cours…"}
        </p>
      )}

      {job?.statut === "erreur" && <p className="result-count" style={{ color: "#B91C1C" }}>Erreur du monteur : {job.erreur || "inconnue"}</p>}

      {job?.statut === "en_validation" && (
        <div style={{ marginTop: 8 }}>
          <p className="result-count" style={{ marginBottom: 6 }}>À vérifier avant le montage final :</p>
          <div style={{ background: "var(--surface-muted, #f8f8f8)", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 8 }}>
            <strong>Transcription :</strong> {job.transcript?.chunks?.map((c) => c.text).join(" ").replace(/\s+/g, " ").trim() || "(non disponible)"}
          </div>
          {job.plan?.ev && job.plan.ev.length > 0 && (
            <ul style={{ fontSize: 13, paddingLeft: 18, marginBottom: 8 }}>
              {job.plan.ev.map((e, i) => (
                <li key={i}>
                  <strong>{LIBELLES_EVENEMENTS[e.t] || e.t}</strong>
                  {e.main ? ` — ${e.main}` : ""}
                  {e.items ? ` — ${e.items.join(", ")}` : ""}
                  {e.lines ? ` — ${e.lines.join(" / ")}` : ""}
                </li>
              ))}
            </ul>
          )}
          <p className="settings-note" style={{ marginBottom: 8 }}>Si un nom, un chiffre ou un montant est mal transcrit, préviens-moi avant de valider — sinon lance le rendu final.</p>
          <button type="button" className="trash-action" onClick={async () => { await validerJobVideo(job.id); setJob({ ...job, statut: "valide" }); }}>
            <CheckCircle2 size={13} /> Tout est correct — lancer le rendu final
          </button>
        </div>
      )}

      {job?.statut === "termine" && job.video_finale_url && (
        <video src={job.video_finale_url} controls style={{ width: "100%", borderRadius: 10, marginTop: 10, maxHeight: 320 }} />
      )}
    </div>
  );
}
