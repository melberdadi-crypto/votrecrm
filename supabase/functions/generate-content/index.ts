// Génère l'idée de publication du jour (textes Facebook + Instagram + visuel) pour chaque agence et chaque marché (Québec, Maroc).
// Appelée : 1) chaque matin par pg_cron (en-tête x-cron-secret) ; 2) par le CRM, bouton « Autre idée » (JWT du propriétaire).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderVisuel } from "./visuel.ts";
import { estMarche, genererIdee, MARCHES, type Marche, TEL_MAROC, today } from "./idee.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function secret(admin: ReturnType<typeof createClient>, name: string) {
  const { data, error } = await admin.rpc("get_app_secret", { secret_name: name });
  if (error || !data) throw new Error(`Secret ${name} introuvable`);
  return data as string;
}

type Reglages = { organization_id: string; signature: string | null; signature_maroc: string | null };
const signatureDe = (r: Reglages, marche: Marche) =>
  (marche === "maroc" ? r.signature_maroc || `Mohamed El Berhdadi · Immobilier au Maroc · WhatsApp / Tél. : ${TEL_MAROC}` : r.signature) || "";

async function creerPublication(admin: ReturnType<typeof createClient>, orgId: string, signature: string, marche: Marche) {
  const { data: recentsData } = await admin
    .from("content_posts").select("theme").eq("organization_id", orgId).eq("marche", marche)
    .order("created_at", { ascending: false }).limit(20);
  const recents = (recentsData || []).map((r: { theme: string | null }) => r.theme).filter(Boolean) as string[];

  const idee = await genererIdee(await secret(admin, "anthropic_api_key"), recents, signature, marche);
  const jpeg = await renderVisuel({
    kicker: idee.kicker, titre: idee.titre_visuel, sousTitre: idee.sous_titre,
    role: marche === "maroc" ? `Immobilier au Maroc · WhatsApp ${TEL_MAROC}` : undefined,
  });

  const path = `${orgId}/${today()}-${marche === "maroc" ? "maroc-" : ""}${crypto.randomUUID().slice(0, 8)}.jpg`;
  const { error: upErr } = await admin.storage.from("content-images").upload(path, jpeg, { contentType: "image/jpeg" });
  if (upErr) throw new Error("Téléversement du visuel : " + upErr.message);
  const { data: pub } = admin.storage.from("content-images").getPublicUrl(path);

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
    image_url: pub.publicUrl,
  }).select().single();
  if (error) throw new Error("Enregistrement : " + error.message);
  return post;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));

    // 1) Appel planifié du matin : une idée par marché (ou seulement ceux de body.marches)
    const cronHeader = req.headers.get("x-cron-secret");
    if (cronHeader) {
      if (cronHeader !== (await secret(admin, "content_cron_secret"))) return json({ error: "Non autorisé" }, 401);
      const marches = Array.isArray(body.marches) ? MARCHES.filter((m) => body.marches.includes(m)) : MARCHES;
      const { data: orgs } = await admin.from("content_settings").select("organization_id, signature, signature_maroc").eq("enabled", true);
      const resultats = [];
      for (const org of (orgs || []) as Reglages[]) {
        for (const marche of marches) {
          const { data: existant } = await admin.from("content_posts").select("id")
            .eq("organization_id", org.organization_id).eq("marche", marche).eq("post_date", today()).neq("status", "refusee").limit(1);
          if (existant && existant.length) { resultats.push({ org: org.organization_id, marche, statut: "déjà générée" }); continue; }
          try {
            const post = await creerPublication(admin, org.organization_id, signatureDe(org, marche), marche);
            resultats.push({ org: org.organization_id, marche, statut: "générée", id: post.id });
          } catch (err) {
            console.error(`Génération impossible (${marche}) :`, String(err));
            resultats.push({ org: org.organization_id, marche, statut: "erreur", erreur: String(err) });
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

    const marche: Marche = estMarche(body.marche) ? body.marche : "quebec";
    if (body.remplacer) {
      await admin.from("content_posts").update({ status: "refusee" })
        .eq("id", body.remplacer).eq("organization_id", reglages.organization_id).eq("status", "proposee");
    }
    const post = await creerPublication(admin, reglages.organization_id, signatureDe(reglages as Reglages, marche), marche);
    return json({ post });
  } catch (err) {
    console.error(err);
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
