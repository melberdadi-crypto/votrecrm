// Script de Reel du jour : généré chaque matin (pg_cron) ou à la demande (« Autre script ») par le propriétaire.
// Le propriétaire peut choisir le public (acheteurs, vendeurs, premiers acheteurs, nouveaux arrivants) et le type (conseil, nouveauté locale).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { choisirSujet, genererScript, PUBLICS } from "./script.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
const numeroJour = () => Math.floor(new Date(`${today()}T12:00:00Z`).getTime() / 86400000);

async function secret(admin: ReturnType<typeof createClient>, name: string) {
  const { data } = await admin.rpc("get_app_secret", { secret_name: name });
  if (!data) throw new Error(`Secret ${name} introuvable`);
  return data as string;
}

type Choix = { publicCible?: string; type?: string };

async function creerScript(admin: ReturnType<typeof createClient>, orgId: string, signature: string, decalage = 0, choix: Choix = {}) {
  const { data: recents } = await admin.from("reel_scripts").select("ville, public_cible, type, titre")
    .eq("organization_id", orgId).order("created_at", { ascending: false }).limit(30);
  const sujet = choisirSujet(recents || [], numeroJour() + decalage);
  if (choix.publicCible) sujet.publicCible = choix.publicCible;
  if (choix.type) sujet.type = choix.type;
  const s = await genererScript(await secret(admin, "anthropic_api_key"), sujet, signature, (recents || []).map((r) => r.titre).filter(Boolean));
  const { data, error } = await admin.from("reel_scripts").insert({
    organization_id: orgId, script_date: today(), ville: sujet.ville, public_cible: sujet.publicCible, type: sujet.type,
    titre: s.titre, accroche: s.accroche, parties: s.parties, duree_secondes: s.duree_secondes,
    conseils_tournage: s.conseils_tournage, legende: s.legende, sources: s.sources,
  }).select().single();
  if (error) throw new Error("Enregistrement : " + error.message);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const cronHeader = req.headers.get("x-cron-secret");
    if (cronHeader) {
      if (cronHeader !== (await secret(admin, "content_cron_secret"))) return json({ error: "Non autorisé" }, 401);
      const { data: orgs } = await admin.from("content_settings").select("organization_id, signature").eq("enabled", true);
      const resultats = [];
      for (const org of orgs || []) {
        const { data: existant } = await admin.from("reel_scripts").select("id")
          .eq("organization_id", org.organization_id).eq("script_date", today()).neq("status", "refuse").limit(1);
        if (existant?.length) { resultats.push({ org: org.organization_id, statut: "déjà généré" }); continue; }
        try {
          const s = await creerScript(admin, org.organization_id, org.signature || "");
          resultats.push({ org: org.organization_id, statut: "généré", id: s.id, ville: s.ville });
        } catch (err) {
          console.error("Script impossible :", String(err));
          resultats.push({ org: org.organization_id, statut: "erreur", erreur: String(err) });
        }
      }
      return json({ resultats });
    }

    // Propriétaire de l'agence (RLS)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: reglages } = await userClient.from("content_settings").select("organization_id, signature").maybeSingle();
    if (!reglages) return json({ error: "Réservé au propriétaire de l'agence" }, 403);
    const body = await req.json().catch(() => ({}));
    if (body.remplacer) {
      await admin.from("reel_scripts").update({ status: "refuse" })
        .eq("id", body.remplacer).eq("organization_id", reglages.organization_id).eq("status", "propose");
    }
    const choix: Choix = {};
    if (typeof body.public === "string" && PUBLICS.includes(body.public)) choix.publicCible = body.public;
    if (body.type === "conseil" || body.type === "nouveaute") choix.type = body.type;
    // « Autre script » sans choix : on décale la rotation pour changer de public et de type
    const decalage = body.remplacer && !choix.publicCible && !choix.type ? Math.floor(Math.random() * 3) + 1 : 0;
    const script = await creerScript(admin, reglages.organization_id, reglages.signature || "", decalage, choix);
    return json({ script });
  } catch (err) {
    console.error(err);
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
