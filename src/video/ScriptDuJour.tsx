import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, MapPin, MonitorPlay, RefreshCw, Users, Video, X } from "lucide-react";
import { supabase } from "../lib/supabase";

export type ReelScript = {
  id: string;
  script_date: string;
  ville: string;
  public_cible: string;
  type: "conseil" | "nouveaute";
  titre: string | null;
  accroche: string | null;
  parties: { partie: string; texte: string }[];
  duree_secondes: number | null;
  conseils_tournage: string | null;
  legende: string | null;
  sources: { titre?: string; url: string }[];
  status: "propose" | "filme" | "refuse";
};

const texteComplet = (s: ReelScript) => s.parties.map((p) => p.texte).join("\n\n");

// Téléprompteur plein écran : texte géant qui défile, vitesse réglable, miroir possible
function Teleprompteur({ script, onClose }: { script: ReelScript; onClose: () => void }) {
  const zone = useRef<HTMLDivElement>(null);
  const [lecture, setLecture] = useState(false);
  const [vitesse, setVitesse] = useState(40); // pixels par seconde
  const [taille, setTaille] = useState(44);
  const [miroir, setMiroir] = useState(false);

  useEffect(() => {
    if (!lecture) return;
    let dernier = performance.now();
    let id = 0;
    const pas = (t: number) => {
      const el = zone.current;
      if (el) {
        el.scrollTop += ((t - dernier) / 1000) * vitesse;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) setLecture(false);
      }
      dernier = t;
      id = requestAnimationFrame(pas);
    };
    id = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(id);
  }, [lecture, vitesse]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); setLecture((l) => !l); }
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [onClose]);

  return (
    <div className="prompteur">
      <div className="prompteur-barre">
        <button type="button" onClick={() => setLecture((l) => !l)}>{lecture ? "Pause" : "Démarrer"}</button>
        <button type="button" onClick={() => { if (zone.current) zone.current.scrollTop = 0; setLecture(false); }}>Recommencer</button>
        <label>Vitesse <input type="range" min={15} max={120} value={vitesse} onChange={(e) => setVitesse(Number(e.target.value))} /></label>
        <label>Taille <input type="range" min={28} max={80} value={taille} onChange={(e) => setTaille(Number(e.target.value))} /></label>
        <label><input type="checkbox" checked={miroir} onChange={(e) => setMiroir(e.target.checked)} /> Miroir</label>
        <button type="button" className="prompteur-fermer" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
      </div>
      <div className="prompteur-zone" ref={zone} onClick={() => setLecture((l) => !l)}>
        <div className="prompteur-repere" />
        <div className="prompteur-texte" style={{ fontSize: taille, transform: miroir ? "scaleX(-1)" : undefined }}>
          <div className="prompteur-marge" />
          {script.parties.map((p, i) => <p key={i}>{p.texte}</p>)}
          <div className="prompteur-marge" />
        </div>
      </div>
      <p className="prompteur-aide">Espace ou clic : démarrer / pause · Échap : fermer. Placez la ligne dorée près de votre caméra.</p>
    </div>
  );
}

export function ScriptDuJour({ connected, onScript }: { connected: boolean; onScript?: (s: ReelScript | null) => void }) {
  const [script, setScript] = useState<ReelScript | null>(null);
  const [charge, setCharge] = useState(true);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  const [prompteur, setPrompteur] = useState(false);
  const [copie, setCopie] = useState("");

  const charger = useCallback(async () => {
    if (!supabase || !connected) { setCharge(false); return; }
    const { data } = await supabase.from("reel_scripts").select("*").neq("status", "refuse")
      .order("script_date", { ascending: false }).order("created_at", { ascending: false }).limit(1);
    const s = (data?.[0] as ReelScript) || null;
    setScript(s); onScript?.(s); setCharge(false);
  }, [connected, onScript]);

  useEffect(() => { void charger(); }, [charger]);

  const autre = async () => {
    if (!supabase) return;
    setOccupe(true); setErreur("");
    try {
      const { error } = await supabase.functions.invoke("generate-script", { body: script && script.status === "propose" ? { remplacer: script.id } : {} });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const detail = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
        throw new Error(detail?.error || error.message);
      }
      await charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Génération impossible");
    } finally {
      setOccupe(false);
    }
  };

  const marquerFilme = async () => {
    if (!supabase || !script) return;
    await supabase.from("reel_scripts").update({ status: "filme" }).eq("id", script.id);
    await charger();
  };

  const copier = async (cle: string, texte: string) => {
    await navigator.clipboard.writeText(texte);
    setCopie(cle); setTimeout(() => setCopie(""), 1800);
  };

  if (!connected || charge) return null;

  return (
    <section className="panel settings-panel script-jour">
      <div className="script-entete">
        <div className="studio-step"><span><Video size={13} /></span><h2>Script du jour</h2></div>
        <button type="button" className="content-secondary" onClick={autre} disabled={occupe}>
          <RefreshCw size={15} className={occupe ? "spin" : ""} /> {occupe ? "L’IA cherche et écrit… (20-30 s)" : script ? "Autre script" : "Générer un script"}
        </button>
      </div>
      {erreur && <p className="content-message erreur">{erreur}</p>}
      {!script ? (
        <p>Aucun script pour l’instant. Un nouveau script arrive chaque matin vers 6 h.</p>
      ) : (
        <>
          <div className="script-meta">
            <span><MapPin size={13} /> {script.ville}</span>
            <span><Users size={13} /> {script.public_cible}</span>
            <span className={`script-type script-type--${script.type}`}>{script.type === "nouveaute" ? "Nouveauté locale" : "Conseil"}</span>
            {script.duree_secondes && <span>≈ {script.duree_secondes} s</span>}
            {script.status === "filme" && <span className="script-filme"><Check size={13} /> Filmé</span>}
          </div>
          {script.accroche && <p className="script-accroche">Texte à l’écran : « {script.accroche} »</p>}
          <div className="script-parties">
            {script.parties.map((p, i) => (
              <div key={i}><strong>{p.partie}</strong><p>{p.texte}</p></div>
            ))}
          </div>
          {script.conseils_tournage && <p className="script-tournage"><strong>Tournage :</strong> {script.conseils_tournage}</p>}
          {script.sources.length > 0 && (
            <div className="script-sources">
              <strong>Sources à vérifier avant de filmer :</strong>
              <ul>{script.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.titre || s.url} <ExternalLink size={11} /></a></li>)}</ul>
            </div>
          )}
          <div className="content-actions">
            <button type="button" className="content-primary" onClick={() => setPrompteur(true)}><MonitorPlay size={15} /> Téléprompteur</button>
            <button type="button" className="content-copy" onClick={() => copier("script", texteComplet(script))}>{copie === "script" ? <Check size={14} /> : <Copy size={14} />} Copier le script</button>
            {script.legende && <button type="button" className="content-copy" onClick={() => copier("legende", script.legende || "")}>{copie === "legende" ? <Check size={14} /> : <Copy size={14} />} Copier la légende</button>}
            {script.status === "propose" && <button type="button" className="content-copy" onClick={marquerFilme}><Check size={14} /> Marquer comme filmé</button>}
          </div>
        </>
      )}
      {prompteur && script && <Teleprompteur script={script} onClose={() => setPrompteur(false)} />}
    </section>
  );
}
