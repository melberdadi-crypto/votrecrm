import { useEffect, useMemo, useRef, useState } from "react";
import { Captions, Check, Clapperboard, Copy, Download, Mic, Music, Palette, Scissors, Send, Sparkles, Upload, Wand2, ZoomIn } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  type Bloc, type Filtre, type Mot, type MotBrut, type Segment, type StyleSousTitres, calculerPlages, construireBlocs, dureeMontee,
  fenetresZoom, genererASS, preparerMots, DUREE_CARTON, FILTRES, STYLES,
} from "./montage";
import { chargerFFmpeg, extraireAudio, monterVideo } from "./moteur";
import { ScriptDuJour, type ReelScript } from "./ScriptDuJour";

type Etape = "choisir" | "analyse" | "edition" | "montage" | "resultat";
const TAILLE_MAX_PUBLICATION = 50 * 1024 * 1024;

async function appeler(body: Record<string, unknown> | FormData) {
  if (!supabase) throw new Error("Connexion au CRM requise.");
  const { data, error } = await supabase.functions.invoke("video-studio", { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const detail = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    throw new Error(detail?.error || error.message);
  }
  return data;
}

const minutes = (s: number) => `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`;

// Réaffecte un texte corrigé aux horaires des mots d'origine du bloc
function appliquerCorrection(bloc: Bloc, texte: string): Bloc {
  const nouveaux = texte.trim().split(/\s+/).filter(Boolean);
  if (!nouveaux.length) return { mots: [] };
  const debut = bloc.mots[0].debut, fin = bloc.mots[bloc.mots.length - 1].fin;
  if (nouveaux.length === bloc.mots.length) return { mots: bloc.mots.map((m, i) => ({ ...m, texte: nouveaux[i] })) };
  // Nombre de mots différent : horaires répartis sur la durée du bloc (les mots-clés de ce bloc sont réinitialisés)
  const pas = (fin - debut) / nouveaux.length;
  return { mots: nouveaux.map((t, i) => ({ texte: t, debut: debut + i * pas, fin: debut + (i + 1) * pas })) };
}

export function VideoStudio({ connected, announce }: { connected: boolean; announce: (m: string) => void }) {
  const [autorise, setAutorise] = useState<boolean | null>(null);
  const [etape, setEtape] = useState<Etape>("choisir");
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercuSource, setApercuSource] = useState("");
  const [duree, setDuree] = useState(0);
  const [mots, setMots] = useState<Mot[]>([]);
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [couper, setCouper] = useState(true);
  const [sousTitres, setSousTitres] = useState(true);
  const [majuscules, setMajuscules] = useState(false);
  const [carton, setCarton] = useState(true);
  const [musique, setMusique] = useState<File | null>(null);
  const [volume, setVolume] = useState(0.2);
  const [style, setStyle] = useState<StyleSousTitres>("or");
  const [accrocheActive, setAccrocheActive] = useState(true);
  const [accroche, setAccroche] = useState("");
  const [zoomsActifs, setZoomsActifs] = useState(true);
  const [zoomSources, setZoomSources] = useState<number[]>([]);
  const [sonStudio, setSonStudio] = useState(true);
  const [filtre, setFiltre] = useState<Filtre>("naturel");
  const [scriptJour, setScriptJour] = useState<ReelScript | null>(null);
  const [statut, setStatut] = useState("");
  const [progres, setProgres] = useState(0);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState<Blob | null>(null);
  const [resultatUrl, setResultatUrl] = useState("");
  const [legende, setLegende] = useState("");
  const [publication, setPublication] = useState<"" | "envoi" | "traitement" | "publie">("");
  const [copie, setCopie] = useState(false);
  const debutMontage = useRef(0);

  useEffect(() => {
    if (!supabase || !connected) return;
    supabase.from("content_settings").select("organization_id").maybeSingle().then(({ data }) => setAutorise(Boolean(data)));
  }, [connected]);

  const plages = useMemo(() => calculerPlages(mots, duree, { marge: 0.15, pauseMax: 0.6, couper }), [mots, duree, couper]);
  const dureeFinale = dureeMontee(plages) + (carton ? DUREE_CARTON : 0);

  const choisir = (f: File | null) => {
    setErreur(""); setResultat(null); setResultatUrl(""); setPublication(""); setLegende("");
    setFichier(f);
    if (apercuSource) URL.revokeObjectURL(apercuSource);
    setApercuSource(f ? URL.createObjectURL(f) : "");
    setEtape(f ? "choisir" : "choisir");
  };

  const analyser = async () => {
    if (!fichier) return;
    setErreur(""); setEtape("analyse");
    try {
      setStatut("Chargement du moteur vidéo (environ 30 Mo la première fois)…");
      const ff = await chargerFFmpeg();
      setStatut("Extraction du son…");
      const audio = await extraireAudio(ff, fichier);
      setStatut("Transcription de votre voix par l’IA…");
      const form = new FormData();
      form.append("audio", new File([audio], "audio.mp3", { type: "audio/mpeg" }));
      const t = await appeler(form) as { texte: string; duree: number; mots: MotBrut[]; segments: Segment[] };
      const prepares = preparerMots(t.mots, t.segments);
      if (!prepares.length) throw new Error("Aucune parole détectée dans cette vidéo.");
      setDuree(t.duree || duree);
      setStatut("L’IA choisit le titre d’accroche, les mots-clés et les zooms…");
      try {
        const a = await appeler({ action: "analyse_ia", mots: prepares.map((m) => m.texte) }) as { accroche: string; mots_cles: number[]; zooms: number[] };
        a.mots_cles.forEach((i) => { if (prepares[i]) prepares[i].cle = true; });
        setAccroche(scriptJour?.status !== "refuse" && scriptJour?.accroche ? scriptJour.accroche : a.accroche || "");
        setZoomSources(a.zooms.map((i) => prepares[i]?.debut).filter((x): x is number => typeof x === "number"));
      } catch { /* l'analyse est un plus : on continue sans */ }
      setMots(prepares);
      setBlocs(construireBlocs(prepares));
      setEtape("edition");
      // La légende se prépare pendant que vous relisez les sous-titres
      appeler({ action: "legende", texte: t.texte }).then((r) => setLegende(r.legende || "")).catch(() => undefined);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Analyse impossible");
      setEtape("choisir");
    }
  };

  const monter = async () => {
    if (!fichier) return;
    setErreur(""); setEtape("montage"); setProgres(0); debutMontage.current = Date.now();
    try {
      const ff = await chargerFFmpeg();
      const blocsValides = blocs.filter((b) => b.mots.length);
      setStatut("Montage en cours… Gardez cet onglet ouvert.");
      const video = await monterVideo(ff, {
        fichier, plages,
        ass: sousTitres || (accrocheActive && accroche.trim())
          ? genererASS(sousTitres ? blocsValides : [], plages, { majuscules, style, accroche: accrocheActive ? accroche : "" })
          : null,
        carton, musique, volumeMusique: volume,
        filtre, sonStudio, zooms: zoomsActifs ? fenetresZoom(zoomSources, plages) : [],
      }, setProgres);
      setResultat(video);
      setResultatUrl(URL.createObjectURL(video));
      setEtape("resultat");
      announce("Vidéo montée");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Montage impossible");
      setEtape("edition");
    }
  };

  const basculerCle = (bi: number, mi: number) =>
    setBlocs((prev) => prev.map((b, k) => (k !== bi ? b : { mots: b.mots.map((m, j) => (j === mi ? { ...m, cle: !m.cle } : m)) })));

  const publier = async () => {
    if (!resultat || !supabase) return;
    setErreur(""); setPublication("envoi");
    try {
      const { path, token } = await appeler({ action: "url_televersement" });
      const { error } = await supabase.storage.from("content-videos").uploadToSignedUrl(path, token, resultat, { contentType: "video/mp4" });
      if (error) throw new Error("Envoi de la vidéo : " + error.message);
      const { creation_id } = await appeler({ action: "publier_reel", path, legende });
      setPublication("traitement");
      // Instagram traite la vidéo (souvent 30 s à 2 min)
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const { statut: s, detail } = await appeler({ action: "statut_reel", creation_id });
        if (s === "FINISHED") {
          await appeler({ action: "finaliser_reel", creation_id, path });
          setPublication("publie");
          announce("Reel publié sur Instagram");
          return;
        }
        if (s === "ERROR" || s === "EXPIRED") throw new Error("Instagram a refusé la vidéo : " + (detail || s));
      }
      throw new Error("Instagram met trop de temps à traiter la vidéo. Réessayez dans quelques minutes.");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Publication impossible");
      setPublication("");
    }
  };

  if (!connected) return <section className="panel settings-panel"><h2>Studio vidéo</h2><p>Connectez-vous pour utiliser le Studio vidéo.</p></section>;
  if (autorise === false) return <section className="panel settings-panel"><h2>Studio vidéo</h2><p>Cet espace est réservé au propriétaire de l’agence.</p></section>;

  const tempsEcoule = etape === "montage" ? (Date.now() - debutMontage.current) / 1000 : 0;

  return (
    <div className="content-studio video-studio">
      <ScriptDuJour connected={connected} onScript={setScriptJour} />
      {erreur && <p className="content-message erreur" role="alert">{erreur}</p>}

      {/* 1. Choix de la vidéo */}
      <section className="panel settings-panel">
        <div className="studio-step"><span>1</span><h2>Votre vidéo</h2></div>
        <p>Filmez à la verticale, en 1080p (pas en 4K), jusqu’à 3 minutes. Utilisez Google Chrome sur votre ordinateur.</p>
        <label className="studio-file">
          <Upload size={16} /> {fichier ? fichier.name : "Choisir une vidéo"}
          <input type="file" accept="video/*" onChange={(e) => choisir(e.target.files?.[0] || null)} disabled={etape === "analyse" || etape === "montage"} />
        </label>
        {apercuSource && (
          <div className="studio-preview-row">
            <video src={apercuSource} controls playsInline onLoadedMetadata={(e) => setDuree(e.currentTarget.duration)} />
            <div>
              <p className="content-note">Durée : {duree ? minutes(duree) : "…"}</p>
              {duree > 200 && <p className="content-message erreur">Cette vidéo dépasse 3 min 20 s : le montage sera long et le Reel trop lourd pour la publication automatique.</p>}
              {etape === "choisir" && (
                <button type="button" className="content-primary" onClick={analyser}><Wand2 size={15} /> Analyser la vidéo</button>
              )}
              {etape === "analyse" && <p className="studio-status">{statut}</p>}
            </div>
          </div>
        )}
      </section>

      {/* 2. Sous-titres et options */}
      {(etape === "edition" || etape === "montage" || etape === "resultat") && (
        <section className="panel settings-panel">
          <div className="studio-step"><span>2</span><h2>Sous-titres et montage</h2></div>
          <p>Corrigez les mots mal compris (noms de rues, de quartiers…). Chaque ligne correspond à ce qui s’affiche à l’écran.</p>
          <div className="studio-blocs">
            {blocs.map((b, i) => (
              <input
                key={i}
                value={b.mots.map((m) => m.texte).join(" ")}
                onChange={(e) => setBlocs((prev) => prev.map((x, k) => (k === i ? appliquerCorrection(x, e.target.value) : x)))}
                disabled={etape === "montage"}
              />
            ))}
          </div>
          <div className="studio-section">
            <h3><Sparkles size={15} /> Mots-clés mis en valeur</h3>
            <p className="content-note">Choisis par l’IA. Cliquez sur un mot pour l’ajouter ou le retirer : il s’affichera plus gros, en or.</p>
            <div className="studio-cles">
              {blocs.map((b, bi) => b.mots.map((m, mi) => (
                <button key={`${bi}-${mi}`} type="button" className={m.cle ? "actif" : ""} onClick={() => basculerCle(bi, mi)} disabled={etape === "montage"}>{m.texte}</button>
              )))}
            </div>
          </div>

          <div className="studio-section">
            <h3><Captions size={15} /> Style des sous-titres</h3>
            <div className="studio-choix">
              {STYLES.map((st) => (
                <button key={st.id} type="button" className={`studio-style studio-style--${st.id}${style === st.id ? " actif" : ""}`} onClick={() => setStyle(st.id)}>
                  <span>{st.id === "impact" ? "VOICI LE" : "Voici le"} <b>prix</b></span>{st.nom}
                </button>
              ))}
            </div>
            <label className="studio-ligne"><input type="checkbox" checked={sousTitres} onChange={(e) => setSousTitres(e.target.checked)} /> Afficher les sous-titres</label>
            {style !== "impact" && <label className="studio-ligne"><input type="checkbox" checked={majuscules} onChange={(e) => setMajuscules(e.target.checked)} /> En MAJUSCULES</label>}
          </div>

          <div className="studio-section">
            <h3><Wand2 size={15} /> Titre d’accroche (3 premières secondes)</h3>
            <label className="studio-ligne"><input type="checkbox" checked={accrocheActive} onChange={(e) => setAccrocheActive(e.target.checked)} /> Afficher le titre d’accroche</label>
            {accrocheActive && <input className="studio-accroche" value={accroche} maxLength={60} placeholder="Ex. Acheteurs à Laval : lisez ceci" onChange={(e) => setAccroche(e.target.value)} />}
          </div>

          <div className="studio-section studio-options">
            <h3><Clapperboard size={15} /> Montage</h3>
            <label><input type="checkbox" checked={couper} onChange={(e) => setCouper(e.target.checked)} /> <Scissors size={14} /> Couper les silences et hésitations</label>
            <label><input type="checkbox" checked={zoomsActifs} onChange={(e) => setZoomsActifs(e.target.checked)} /> <ZoomIn size={14} /> Zooms automatiques ({zoomSources.length} moments forts repérés par l’IA)</label>
            <label><input type="checkbox" checked={sonStudio} onChange={(e) => setSonStudio(e.target.checked)} /> <Mic size={14} /> Son studio (réduction du bruit, voix plus pleine, volume uniforme)</label>
            <label><input type="checkbox" checked={carton} onChange={(e) => setCarton(e.target.checked)} /> <Clapperboard size={14} /> Carton de fin (logo, nom, site)</label>
            <label className="studio-file studio-file--small">
              <Music size={14} /> {musique ? musique.name : "Ajouter une musique (libre de droits)"}
              <input type="file" accept="audio/*" onChange={(e) => setMusique(e.target.files?.[0] || null)} />
            </label>
            {musique && (
              <label className="studio-volume">Volume de la musique
                <input type="range" min={0.05} max={0.5} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
                <button type="button" className="content-copy" onClick={() => setMusique(null)}>Retirer</button>
              </label>
            )}
          </div>

          <div className="studio-section">
            <h3><Palette size={15} /> Couleurs</h3>
            <div className="studio-choix">
              {FILTRES.map((fi) => (
                <button key={fi.id} type="button" className={`studio-filtre studio-filtre--${fi.id}${filtre === fi.id ? " actif" : ""}`} onClick={() => setFiltre(fi.id)}>
                  <span />{fi.nom}
                </button>
              ))}
            </div>
          </div>

          <p className="content-note">
            Durée originale {minutes(duree)} → durée montée {minutes(dureeFinale)}
            {couper ? ` (${Math.max(0, Math.round(duree - dureeMontee(plages)))} s de silences coupées)` : ""}.
          </p>
          {etape === "edition" && (
            <button type="button" className="content-primary" onClick={monter}><Clapperboard size={15} /> Monter la vidéo</button>
          )}
          {etape === "montage" && (
            <div className="studio-progress">
              <div><span style={{ width: `${Math.round(progres * 100)}%` }} /></div>
              <p className="studio-status">{statut} {Math.round(progres * 100)} % · {Math.round(tempsEcoule)} s</p>
            </div>
          )}
        </section>
      )}

      {/* 3. Résultat, légende, publication */}
      {etape === "resultat" && resultat && (
        <section className="panel content-today">
          <div className="content-visual">
            <video src={resultatUrl} controls playsInline />
            <a className="content-copy" href={resultatUrl} download={`reel-${new Date().toISOString().slice(0, 10)}.mp4`}><Download size={14} /> Télécharger la vidéo</a>
            <p className="content-note">Taille : {(resultat.size / 1024 / 1024).toFixed(1)} Mo</p>
          </div>
          <div className="content-texts">
            <div className="studio-step"><span>3</span><h2>Légende et publication</h2></div>
            <label>
              <span>Légende Instagram</span>
              <textarea rows={9} value={legende} placeholder="L’IA rédige la légende…" onChange={(e) => setLegende(e.target.value)} />
            </label>
            {scriptJour?.legende && (
              <button type="button" className="content-copy" onClick={() => setLegende(scriptJour.legende || "")}>Utiliser la légende du script du jour</button>
            )}
            <button type="button" className="content-copy" onClick={async () => { await navigator.clipboard.writeText(legende); setCopie(true); setTimeout(() => setCopie(false), 1800); }}>
              {copie ? <Check size={14} /> : <Copy size={14} />} {copie ? "Copié" : "Copier la légende"}
            </button>
            <div className="content-actions">
              <button type="button" className="content-secondary" onClick={() => setEtape("edition")} disabled={Boolean(publication && publication !== "publie")}>Modifier et remonter</button>
              {resultat.size <= TAILLE_MAX_PUBLICATION ? (
                <button type="button" className="content-primary" onClick={publier} disabled={Boolean(publication) || !legende.trim()}>
                  <Send size={15} />
                  {publication === "envoi" ? "Envoi de la vidéo…" : publication === "traitement" ? "Instagram traite la vidéo…" : publication === "publie" ? "Publié ✓" : "Publier en Reel sur Instagram"}
                </button>
              ) : (
                <p className="content-message erreur">Vidéo trop lourde pour la publication automatique (max 50 Mo). Téléchargez-la et publiez-la depuis l’application Instagram.</p>
              )}
            </div>
            {publication === "publie" && <p className="content-message ok">Votre Reel est en ligne sur Instagram.</p>}
            <p className="content-note">Pour Facebook : téléchargez la vidéo et copiez la légende.</p>
          </div>
        </section>
      )}
    </div>
  );
}
