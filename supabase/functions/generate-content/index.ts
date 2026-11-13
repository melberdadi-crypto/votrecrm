// deno-lint-ignore-file no-explicit-any
// Génère l'idée de publication du jour (textes Facebook + Instagram + visuel) pour chaque agence et chaque marché (Québec, Maroc).
// Appelée : 1) chaque matin par pg_cron (en-tête x-cron-secret) ; 2) par le CRM, bouton « Autre idée » (JWT du propriétaire).
// Publications ciblées par type de propriété (condo, maison, duplex, triplex, quadruplex, terrain) :
//   - chaque matin, au Québec : une pour les vendeurs (« On recherche ») et une pour les acheteurs, types en rotation ;
//   - à la demande : { type: "recherche" | "acheteurs", type_propriete, secteur?, budget? }.
// Rien n'est publié sans validation : tout arrive au statut « proposee ».
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderVisuel } from "./visuel.ts";
import { estMarche, genererIdee, MARCHES, type Marche, TEL_MAROC, today } from "./idee.ts";
import {
  avecLienCampagne, cibleDe, type Demande, demandeAcheteurs, estTypeRecherche, exigerAcheteurs, genererPublicationCiblee, lienCampagne, type Public, typeContenuDe, typeDuJour,
} from "./recherche.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const numeroJour = () => Math.floor(new Date(`${today()}T12:00:00Z`).getTime() / 86400000);

async function secret(admin: any, name: string) {
  const { data, error } = await admin.rpc("get_app_secret", { secret_name: name });
  if (error || !data) throw new Error(`Secret ${name} introuvable`);
  return data as string;
}

type Reglages = { organization_id: string; signature: string | null; signature_maroc: string | null };
const signatureDe = (r: Reglages, marche: Marche) =>
  (marche === "maroc" ? r.signature_maroc || `Mohamed El Berhdadi · Immobilier au Maroc · WhatsApp / Tél. : ${TEL_MAROC}` : r.signature) || "";

async function televerser(admin: any, orgId: string, jpeg: Uint8Array, prefixe: string) {
  const path = `${orgId}/${today()}-${prefixe}${crypto.randomUUID().slice(0, 8)}.jpg`;
  const { error: upErr } = await admin.storage.from("content-images").upload(path, jpeg, { contentType: "image/jpeg" });
  if (upErr) throw new Error("Téléversement du visuel : " + upErr.message);
  return admin.storage.from("content-images").getPublicUrl(path).data.publicUrl as string;
}

async function creerPublication(admin: any, orgId: string, signature: string, marche: Marche) {
  const { data: recentsData } = await admin
    .from("content_posts").select("theme").eq("organization_id", orgId).eq("marche", marche).eq("type_contenu", "conseil")
    .order("created_at", { ascending: false }).limit(20);
  const recents = (recentsData || []).map((r: { theme: string | null }) => r.theme).filter(Boolean) as string[];

  const idee = await genererIdee(await secret(admin, "anthropic_api_key"), recents, signature, marche);
  const jpeg = await renderVisuel({
    kicker: idee.kicker, titre: idee.titre_visuel, sousTitre: idee.sous_titre,
    role: marche === "maroc" ? `Immobilier au Maroc · WhatsApp ${TEL_MAROC}` : undefined,
  });
  const imageUrl = await televerser(admin, orgId, jpeg, marche === "maroc" ? "maroc-" : "");

  const { data: post, error } = await admin.from("content_posts").insert({
    organization_id: orgId,
    marche,
    post_date: today(),
    theme: idee.theme,
    kicker: idee.kicker,
    titre_visuel: idee.titre_visuel,
    sous_titre: idee.sous_titre,
    texte_facebook: idee.texte_facebook,
    texte_instagram: idee.texte_instagram,
    image_url: imageUrl,
  }).select().single();
  if (error) throw new Error("Enregistrement : " + error.message);
  return post;
}

// Publication ciblée par type de propriété (Québec : les acheteurs du CRM sont au Québec)
async function creerCiblee(admin: any, orgId: string, signature: string, pub: Public, demande: Demande) {
  if (pub === "vendeurs") exigerAcheteurs(demande);
  const typeContenu = typeContenuDe(pub);
  const { data: recentsData } = await admin.from("content_posts").select("titre_visuel")
    .eq("organization_id", orgId).eq("type_contenu", typeContenu).order("created_at", { ascending: false }).limit(15);
  const recents = (recentsData || []).map((r: { titre_visuel: string | null }) => r.titre_visuel).filter(Boolean) as string[];

  const p = await genererPublicationCiblee(await secret(admin, "anthropic_api_key"), pub, demande, signature, recents);
  const jpeg = await renderVisuel({ kicker: p.kicker, titre: p.titre_visuel, sousTitre: p.sous_titre });
  const imageUrl = await televerser(admin, orgId, jpeg, `${typeContenu}-${demande.type_propriete}-`);
  const { data: post, error } = await admin.from("content_posts").insert({
    organization_id: orgId,
    marche: "quebec",
    type_contenu: typeContenu,
    cible: cibleDe(pub, demande, p.zone),
    post_date: today(),
    theme: p.theme,
    kicker: p.kicker,
    titre_visuel: p.titre_visuel,
    sous_titre: p.sous_titre,
    texte_facebook: p.texte_facebook,
    texte_instagram: p.texte_instagram,
    image_url: imageUrl,
  }).select().single();
  if (error) throw new Error("Enregistrement : " + error.message);
  // Le lien Facebook ouvre le bon formulaire du site et rattache le lead à cette publication
  const texteFb = avecLienCampagne(post.texte_facebook || "", lienCampagne(pub, demande, post.id));
  if (texteFb !== post.texte_facebook) {
    await admin.from("content_posts").update({ texte_facebook: texteFb }).eq("id", post.id);
    post.texte_facebook = texteFb;
  }
  return post;
}

async function dejaFaite(admin: any, orgId: string, marche: Marche, typeContenu: string) {
  const { data } = await admin.from("content_posts").select("id")
    .eq("organization_id", orgId).eq("marche", marche).eq("post_date", today())
    .eq("type_contenu", typeContenu).neq("status", "refusee").limit(1);
  return Boolean(data && data.length);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));

    // 1) Appel planifié du matin : une idée par marché (ou seulement ceux de body.marches),
    //    Avec { ciblees: true } (2e tâche du matin) : au Québec, une publication ciblée vendeurs et une ciblée acheteurs.
    const cronHeader = req.headers.get("x-cron-secret");
    if (cronHeader) {
      if (cronHeader !== (await secret(admin, "content_cron_secret"))) return json({ error: "Non autorisé" }, 401);
      const marches = Array.isArray(body.marches) ? MARCHES.filter((m) => body.marches.includes(m)) : MARCHES;
      const { data: orgs } = await admin.from("content_settings").select("organization_id, signature, signature_maroc").eq("enabled", true);
      const resultats: Record<string, unknown>[] = [];
      for (const org of (orgs || []) as Reglages[]) {
        for (const marche of marches) {
          if (body.ciblees) {
            // Tâche séparée (generate-content-ciblees-daily) : seulement les publications ciblées
          } else if (await dejaFaite(admin, org.organization_id, marche, "conseil")) {
            resultats.push({ org: org.organization_id, marche, statut: "déjà générée" });
          } else {
            try {
              const post = await creerPublication(admin, org.organization_id, signatureDe(org, marche), marche);
              resultats.push({ org: org.organization_id, marche, statut: "générée", id: post.id });
            } catch (err) {
              console.error(`Génération impossible (${marche}) :`, String(err));
              resultats.push({ org: org.organization_id, marche, statut: "erreur", erreur: String(err) });
            }
          }
          if (marche !== "quebec" || !body.ciblees) continue;
          for (const pub of ["vendeurs", "acheteurs"] as Public[]) {
            if (await dejaFaite(admin, org.organization_id, marche, typeContenuDe(pub))) {
              resultats.push({ org: org.organization_id, marche, public: pub, statut: "déjà générée" });
              continue;
            }
            try {
              const demande = await typeDuJour(admin, org.organization_id, pub, numeroJour());
              if (!demande) { resultats.push({ org: org.organization_id, marche, public: pub, statut: "aucun acheteur dans le CRM" }); continue; }
              const post = await creerCiblee(admin, org.organization_id, signatureDe(org, marche), pub, demande);
              resultats.push({ org: org.organization_id, marche, public: pub, type: demande.type_propriete, statut: "générée", id: post.id });
            } catch (err) {
              console.error(`Publication ciblée impossible (${pub}) :`, String(err));
              resultats.push({ org: org.organization_id, marche, public: pub, statut: "erreur", erreur: String(err) });
            }
          }
        }
      }
      return json({ resultats });
    }

    // 2) Bouton « Autre idée » dans le CRM (réservé au propriétaire, vérifié par RLS)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: reglages } = await userClient.from("content_settings").select("organization_id, signature, signature_maroc").maybeSingle();
    if (!reglages) return json({ error: "Réservé au propriétaire de l'agence" }, 403);

    if (body.remplacer) {
      await admin.from("content_posts").update({ status: "refusee" })
        .eq("id", body.remplacer).eq("organization_id", reglages.organization_id).eq("status", "proposee");
    }

    // 3) Publication ciblée : type "recherche" (vise les vendeurs) ou "acheteurs"
    if (body.type === "recherche" || body.type === "acheteurs") {
      const pub: Public = body.type === "recherche" ? "vendeurs" : "acheteurs";
      const type = estTypeRecherche(body.type_propriete) ? body.type_propriete : "duplex";
      const demande = await demandeAcheteurs(admin, reglages.organization_id, type, {
        secteur: typeof body.secteur === "string" ? body.secteur.slice(0, 80) : undefined,
        budget: typeof body.budget === "string" ? body.budget.slice(0, 60) : undefined,
      });
      const post = await creerCiblee(admin, reglages.organization_id, signatureDe(reglages as Reglages, "quebec"), pub, demande);
      return json({ post });
    }

    const marche: Marche = estMarche(body.marche) ? body.marche : "quebec";
    const post = await creerPublication(admin, reglages.organization_id, signatureDe(reglages as Reglages, marche), marche);
    return json({ post });
  } catch (err) {
    console.error(err);
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
