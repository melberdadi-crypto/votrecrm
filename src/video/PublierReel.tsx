import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Copy, Download, Facebook, Instagram, Loader2, Send, X, XCircle } from "lucide-react";
import { supabase } from "../lib/supabase";

// Publication d'un Reel monté (Monteur Reels) sur Instagram et Facebook, après vérification.
// Passe par la fonction Supabase « publier-reel » (jeton Meta stocké côté serveur).

const TAILLE_MAX = 50 * 1024 * 1024; // limite du stockage content-videos
const SITE = "www.mohamedelberhdadi.ca";

type Etape = { cle: string; libelle: string; etat: "attente" | "encours" | "ok" | "erreur"; detail?: string };

async function appeler(body: Record<string, unknown>) {
  if (!supabase) throw new Error("Connexion au CRM requise.");
  const { data, error } = await supabase.functions.invoke("publier-reel", { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const detail = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    throw new Error(detail?.error || error.message);
  }
  return data;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

function BoutonCopier({ texte }: { texte: string }) {
  const [fait, setFait] = useState(false);
  return (
    <button type="button" className="trash-action" onClick={async () => { try { await navigator.clipboard.writeText(texte); setFait(true); setTimeout(() => setFait(false), 1800); } catch { /* copie manuelle */ } }}>
      <Copy size={13} /> {fait ? "Copié" : "Copier le texte"}
    </button>
  );
}

export function PublierReel({ blob, texte, onClose }: { blob: Blob; texte: string; onClose: () => void }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const [chargement, setChargement] = useState(true);
  const [legIg, setLegIg] = useState("");
  const [legFb, setLegFb] = useState("");
  const [ig, setIg] = useState(true);
  const [fb, setFb] = useState(true);
  const [actifs, setActifs] = useState({ instagram: true, facebook: true });
  const [verifie, setVerifie] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [fini, setFini] = useState(false);
  const [etapes, setEtapes] = useState<Etape[]>([]);
  const [erreur, setErreur] = useState("");
  const [lienIg, setLienIg] = useState("");
  const [note, setNote] = useState("");
  const tropLourde = blob.size > TAILLE_MAX;

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const res = await appeler({ action: "legendes", texte });
        if (annule) return;
        setLegIg(res.instagram || ""); setLegFb(res.facebook || "");
        setActifs({ instagram: Boolean(res.instagram_actif), facebook: Boolean(res.facebook_actif) });
        setIg(Boolean(res.instagram_actif)); setFb(Boolean(res.facebook_actif));
        if (res.secours) setNote("Texte de base proposé (la rédaction automatique n'a pas répondu) : relisez-le et ajustez-le.");
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : "Impossible de préparer le texte.");
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => { annule = true; };
  }, [texte]);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape" && !enCours) onClose(); };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [enCours, onClose]);

  const maj = (cle: string, etat: Etape["etat"], detail?: string) =>
    setEtapes((liste) => liste.map((e) => (e.cle === cle ? { ...e, etat, detail } : e)));

  async function publier() {
    setErreur(""); setEnCours(true); setLienIg("");
    const liste: Etape[] = [{ cle: "envoi", libelle: "Envoi de la vidéo", etat: "attente" }];
    if (ig) liste.push({ cle: "ig_prep", libelle: "Instagram : préparation du Reel", etat: "attente" }, { cle: "ig_pub", libelle: "Instagram : publication", etat: "attente" });
    if (fb) liste.push({ cle: "fb", libelle: "Facebook : publication du Reel", etat: "attente" });
    setEtapes(liste);
    try {
      maj("envoi", "encours");
      if (!supabase) throw new Error("Connexion au CRM requise.");
      const { path, token } = await appeler({ action: "url_televersement" });
      const { error: errEnvoi } = await supabase.storage.from("content-videos").uploadToSignedUrl(path, token, blob, { contentType: "video/mp4" });
      if (errEnvoi) throw new Error("Envoi de la vidéo : " + errEnvoi.message);
      maj("envoi", "ok");

      if (ig) maj("ig_prep", "encours");
      if (fb) maj("fb", "encours");
      const res = await appeler({ action: "publier", path, instagram: ig, facebook: fb, legende_instagram: legIg, legende_facebook: legFb });

      if (fb) {
        if (res.facebook?.video_id) maj("fb", "ok", "Publié sur la page Facebook (traitement par Facebook quelques minutes).");
        else maj("fb", "erreur", res.erreurs?.facebook || "Échec");
      }
      if (ig) {
        if (!res.instagram?.creation_id) { maj("ig_prep", "erreur", res.erreurs?.instagram || "Échec"); maj("ig_pub", "erreur", "Non publié"); }
        else {
          let pret = false;
          for (let i = 0; i < 72; i++) {
            await pause(5000);
            const s = await appeler({ action: "statut", creation_id: res.instagram.creation_id });
            if (s.statut === "FINISHED") { pret = true; break; }
            if (s.statut === "ERROR" || s.statut === "EXPIRED") throw new Error(`Instagram a refusé la vidéo${s.detail ? ` : ${s.detail}` : ""}.`);
            maj("ig_prep", "encours", `Instagram traite la vidéo… (${Math.round((i + 1) * 5)} s)`);
          }
          if (!pret) throw new Error("Instagram met trop de temps à traiter la vidéo. Réessayez dans quelques minutes.");
          maj("ig_prep", "ok");
          maj("ig_pub", "encours");
          const fin = await appeler({ action: "finaliser", creation_id: res.instagram.creation_id });
          setLienIg(fin.permalink || "");
          maj("ig_pub", "ok", "Publié sur Instagram.");
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publication impossible.";
      setErreur(msg);
      setEtapes((l) => l.map((x) => (x.etat === "encours" ? { ...x, etat: "erreur", detail: msg } : x)));
    } finally {
      setEnCours(false); setFini(true);
    }
  }

  const fbEchec = etapes.find((e) => e.cle === "fb" && e.etat === "erreur");
  const peutPublier = !chargement && !enCours && !fini && verifie && (ig || fb) && !tropLourde && (!ig || legIg.trim()) && (!fb || legFb.trim());
  const icone = (e: Etape) => e.etat === "ok" ? <CheckCircle2 size={15} color="#2F7D4A" /> : e.etat === "erreur" ? <XCircle size={15} color="#B61D0A" /> : e.etat === "encours" ? <Loader2 size={15} className="spin" /> : <span style={{ width: 15, display: "inline-block" }}>·</span>;

  return createPortal(
    <div className="modal-layer" style={{ zIndex: 90 }} role="dialog" aria-modal="true" aria-label="Publier le Reel">
      <div style={{ width: "min(980px, 100%)", background: "var(--surface, #fff)", borderRadius: 14, padding: 18, boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Publier le Reel</h2>
          <button type="button" className="trash-action" onClick={onClose} disabled={enCours}><X size={14} /> Fermer</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)", gap: 18 }} className="publier-grille">
          <div>
            <video src={url} controls playsInline style={{ width: "100%", aspectRatio: "9 / 16", background: "#000", borderRadius: 12 }} />
            <p className="settings-note" style={{ marginTop: 6 }}>{(blob.size / 1e6).toFixed(1)} Mo</p>
            <a className="trash-action" href={url} download="reel.mp4" style={{ display: "inline-flex" }}><Download size={13} /> Télécharger</a>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            {tropLourde && <p className="result-count" style={{ color: "#B91C1C" }}>Vidéo trop lourde pour la publication ({(blob.size / 1e6).toFixed(0)} Mo, maximum 50 Mo). Raccourcissez-la à 90 secondes ou moins, puis exportez à nouveau.</p>}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label className="consent" style={{ margin: 0 }}><input type="checkbox" checked={ig} disabled={!actifs.instagram || enCours || fini} onChange={(e) => setIg(e.target.checked)} /><span><Instagram size={14} style={{ verticalAlign: "-2px" }} /> Instagram (Reel){!actifs.instagram && " · non relié"}</span></label>
              <label className="consent" style={{ margin: 0 }}><input type="checkbox" checked={fb} disabled={!actifs.facebook || enCours || fini} onChange={(e) => setFb(e.target.checked)} /><span><Facebook size={14} style={{ verticalAlign: "-2px" }} /> Facebook (Reel){!actifs.facebook && " · non relié"}</span></label>
            </div>
            {chargement ? <p className="result-count"><Loader2 size={14} className="spin" style={{ verticalAlign: "-2px" }} /> Rédaction du texte de publication…</p> : (
              <>
                {note && <p className="settings-note">{note}</p>}
                {ig && <label>Texte Instagram <span className="settings-note">(lien non cliquable : « lien dans la bio »)</span><textarea rows={7} value={legIg} onChange={(e) => setLegIg(e.target.value)} disabled={enCours || fini} /></label>}
                {fb && <label>Texte Facebook <span className="settings-note">(lien cliquable)</span><textarea rows={6} value={legFb} onChange={(e) => setLegFb(e.target.value)} disabled={enCours || fini} /></label>}
                <p className="settings-note">Le lien {SITE} est ajouté automatiquement s'il manque dans un texte.</p>
              </>
            )}
            {!fini && (
              <label className="consent" style={{ margin: 0 }}>
                <input type="checkbox" checked={verifie} onChange={(e) => setVerifie(e.target.checked)} disabled={enCours} />
                <span>J'ai regardé la vidéo en entier et relu le texte : tout est correct.</span>
              </label>
            )}
            {!fini && <div><button type="button" className="trash-action" style={{ background: "#B61D0A", color: "#fff", borderColor: "#B61D0A" }} disabled={!peutPublier} onClick={publier}><Send size={13} /> {enCours ? "Publication en cours…" : "Publier maintenant"}</button></div>}
            {etapes.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
                {etapes.map((e) => <li key={e.cle} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>{icone(e)}<span><strong>{e.libelle}</strong>{e.detail ? <><br /><span className="settings-note">{e.detail}</span></> : null}</span></li>)}
              </ul>
            )}
            {erreur && <p className="result-count" style={{ color: "#B91C1C" }}>{erreur}</p>}
            {lienIg && <a href={lienIg} target="_blank" rel="noreferrer" className="trash-action" style={{ display: "inline-flex" }}><Instagram size={13} /> Voir le Reel sur Instagram</a>}
            {fbEchec && (
              <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, padding: 10 }}>
                <p className="settings-note" style={{ marginTop: 0 }}>Pour Facebook : téléchargez la vidéo, puis publiez-la en Reel depuis Meta Business Suite avec ce texte.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <BoutonCopier texte={legFb} />
                  <a className="trash-action" href={url} download="reel.mp4" style={{ display: "inline-flex" }}><Download size={13} /> Télécharger la vidéo</a>
                  <a className="trash-action" href="https://business.facebook.com/latest/reels_composer" target="_blank" rel="noreferrer" style={{ display: "inline-flex" }}><Facebook size={13} /> Ouvrir Meta Business Suite</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
