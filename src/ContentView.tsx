import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, Instagram, Facebook, RefreshCw, Send, Sparkles } from "lucide-react";
import { supabase } from "./lib/supabase";

type ContentPost = {
  id: string;
  post_date: string;
  theme: string | null;
  kicker: string | null;
  titre_visuel: string | null;
  texte_facebook: string | null;
  texte_instagram: string | null;
  image_url: string | null;
  status: "proposee" | "en_publication" | "publiee" | "refusee" | "erreur";
  ig_media_id: string | null;
  fb_post_id: string | null;
  error: string | null;
  published_at: string | null;
  created_at: string;
};

const statusLabels: Record<ContentPost["status"], string> = {
  proposee: "À valider",
  en_publication: "Publication en cours",
  publiee: "Publiée",
  refusee: "Écartée",
  erreur: "Erreur",
};

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

async function invoke(name: string, body: Record<string, unknown>) {
  if (!supabase) throw new Error("Connexion au CRM requise.");
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // Récupère le message d'erreur renvoyé par la fonction, s'il existe
    const ctx = (error as { context?: Response }).context;
    const detail = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    if (detail?.erreurs?.length) throw new Error(detail.erreurs.join(" · "));
    throw new Error(detail?.error || error.message);
  }
  return data;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="content-copy"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copié" : label}
    </button>
  );
}

export function ContentView({ connected, announce }: { connected: boolean; announce: (message: string) => void }) {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "publier" | "generer">("");
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; text: string } | null>(null);
  const [texteIg, setTexteIg] = useState("");
  const [texteFb, setTexteFb] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !connected) { setLoading(false); return; }
    setLoading(true);
    const [{ data: settings }, { data }] = await Promise.all([
      supabase.from("content_settings").select("organization_id").maybeSingle(),
      supabase.from("content_posts").select("*").order("post_date", { ascending: false }).order("created_at", { ascending: false }).limit(40),
    ]);
    setAllowed(Boolean(settings));
    const list = (data || []) as ContentPost[];
    setPosts(list);
    const current = list.find((p) => p.status === "proposee" || p.status === "erreur");
    setTexteIg(current?.texte_instagram || "");
    setTexteFb(current?.texte_facebook || "");
    setLoading(false);
  }, [connected]);

  useEffect(() => { void load(); }, [load]);

  const current = posts.find((p) => p.status === "proposee" || p.status === "erreur");
  const historique = posts.filter((p) => p.status === "publiee" || (p.status === "refusee" && p !== current)).slice(0, 12);

  const publier = async () => {
    if (!current) return;
    setBusy("publier"); setMessage(null);
    try {
      const res = await invoke("publish-content", { post_id: current.id, texte_instagram: texteIg, texte_facebook: texteFb });
      const parts = [];
      if (res?.instagram) parts.push("Instagram ✓");
      if (res?.facebook) parts.push("Facebook ✓");
      const fbManuel = !res?.facebook;
      setMessage({
        type: "ok",
        text: `Publié : ${parts.join(" · ")}.${fbManuel ? " Pour Facebook, copiez le texte et téléchargez l’image ci-dessous (publication automatique pas encore activée)." : ""}`,
      });
      announce("Publication envoyée");
      await load();
    } catch (err) {
      setMessage({ type: "erreur", text: err instanceof Error ? err.message : "Publication impossible" });
      await load();
    } finally {
      setBusy("");
    }
  };

  const generer = async () => {
    setBusy("generer"); setMessage(null);
    try {
      await invoke("generate-content", current && current.status === "proposee" ? { remplacer: current.id } : {});
      announce("Nouvelle idée prête");
      await load();
    } catch (err) {
      setMessage({ type: "erreur", text: err instanceof Error ? err.message : "Génération impossible" });
    } finally {
      setBusy("");
    }
  };

  if (!connected) {
    return <section className="panel settings-panel"><h2>Contenu</h2><p>Connectez-vous pour voir vos idées de publication.</p></section>;
  }
  if (loading) {
    return <section className="panel settings-panel"><p>Chargement…</p></section>;
  }
  if (allowed === false) {
    return <section className="panel settings-panel"><h2>Contenu</h2><p>Cet espace est réservé au propriétaire de l’agence.</p></section>;
  }

  // Dernière publication réussie (pour garder le téléchargement disponible après une publication Facebook manuelle)
  const dernierePubliee = posts.find((p) => p.status === "publiee");

  return (
    <div className="content-studio">
      {message && <p className={`content-message ${message.type}`} role="status">{message.text}</p>}

      {current ? (
        <section className="panel content-today">
          <div className="content-visual">
            {current.image_url && <img src={current.image_url} alt={current.titre_visuel || "Visuel du jour"} />}
            {current.image_url && (
              <a className="content-copy" href={current.image_url} download target="_blank" rel="noreferrer"><Download size={14} /> Télécharger l’image</a>
            )}
          </div>
          <div className="content-texts">
            <div className="content-meta">
              <span className="content-badge">{statusLabels[current.status]}</span>
              <span>{formatDate(current.post_date)}</span>
              {current.theme && <span>· {current.theme}</span>}
            </div>
            {current.status === "erreur" && current.error && <p className="content-message erreur">{current.error}</p>}

            <label>
              <span><Instagram size={15} /> Texte Instagram</span>
              <textarea value={texteIg} onChange={(e) => setTexteIg(e.target.value)} rows={9} />
            </label>
            <CopyButton text={texteIg} label="Copier le texte Instagram" />

            <label>
              <span><Facebook size={15} /> Texte Facebook</span>
              <textarea value={texteFb} onChange={(e) => setTexteFb(e.target.value)} rows={8} />
            </label>
            <CopyButton text={texteFb} label="Copier le texte Facebook" />

            <div className="content-actions">
              <button type="button" className="content-secondary" disabled={Boolean(busy)} onClick={generer}>
                <RefreshCw size={15} className={busy === "generer" ? "spin" : ""} /> {busy === "generer" ? "L’IA prépare une autre idée…" : "Autre idée"}
              </button>
              <button type="button" className="content-primary" disabled={Boolean(busy)} onClick={publier}>
                <Send size={15} /> {busy === "publier" ? "Publication…" : "Valider et publier"}
              </button>
            </div>
            <p className="content-note">« Valider et publier » publie sur Instagram immédiatement. Vous pouvez modifier les textes avant de valider.</p>
          </div>
        </section>
      ) : (
        <section className="panel settings-panel content-empty">
          <Sparkles size={22} />
          <h2>Aucune idée en attente</h2>
          <p>Une nouvelle idée de publication arrive chaque matin vers 6 h. Vous pouvez aussi en demander une maintenant.</p>
          <button type="button" className="content-primary" disabled={Boolean(busy)} onClick={generer}>
            <Sparkles size={15} /> {busy === "generer" ? "L’IA prépare une idée…" : "Générer une idée maintenant"}
          </button>
          {dernierePubliee?.image_url && !dernierePubliee.fb_post_id && (
            <div className="content-fb-manual">
              <p>Publication Facebook manuelle de la dernière idée :</p>
              <div className="content-actions">
                <CopyButton text={dernierePubliee.texte_facebook || ""} label="Copier le texte Facebook" />
                <a className="content-copy" href={dernierePubliee.image_url} download target="_blank" rel="noreferrer"><Download size={14} /> Télécharger l’image</a>
              </div>
            </div>
          )}
        </section>
      )}

      {historique.length > 0 && (
        <section className="panel content-history">
          <div className="panel-heading"><div><h2>Historique</h2><p>Vos dernières idées publiées ou écartées</p></div></div>
          <ul>
            {historique.map((p) => (
              <li key={p.id}>
                {p.image_url && <img src={p.image_url} alt="" />}
                <div>
                  <strong>{p.titre_visuel || p.theme}</strong>
                  <span>{formatDate(p.post_date)} · {statusLabels[p.status]}{p.status === "publiee" ? ` (${[p.ig_media_id && "Instagram", p.fb_post_id && "Facebook"].filter(Boolean).join(" + ") || "—"})` : ""}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
