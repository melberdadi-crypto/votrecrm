// deno-lint-ignore-file no-explicit-any
// Script de Reel du jour : généré chaque matin (pg_cron) ou à la demande (« Autre script ») par le propriétaire.
// Deux marchés : le Québec (Laval, Rive-Nord, Lanaudière) et le Maroc (Casablanca, Marrakech, El Jadida, Mohammedia, Rabat, Tanger).
// Le propriétaire peut choisir le marché, le public (acheteurs, vendeurs, premiers acheteurs, nouveaux arrivants) et le type (conseil, nouveauté locale).
// Reels ciblés par type de propriété (condo, maison, duplex, triplex, quadruplex, terrain) :
//   { type: "recherche" (vise les vendeurs, critères des vrais acheteurs du CRM) | "acheteurs", type_propriete, secteur?, budget? }
import { createClient } from "jsr:@supabase/supabase-js@2";
import { choisirSujet, estMarche, genererScript, MARCHES, type Marche, publicsDe, TEL_MAROC } from "./script.ts";
import { cibleDe, demandeAcheteurs, estTypeRecherche, exigerAcheteurs, genererReelCible, type Public, typeContenuDe } from "./recherche.ts";

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

async function secret(admin: any, name: string) {
  const { data } = await admin.rpc("get_app_secret", { secret_name: name });
  if (!data) throw new Error(`Secret ${name} introuvable`);
  return data as string;
}

type Choix = { publicCible?: string; type?: string };
type Reglages = { organization_id: string; signature: string | null; signature_maroc: string | null };
const signatureDe = (r: Reglages, marche: Marche) =>
  (marche === "maroc" ? r.signature_maroc || `Mohamed El Berhdadi · Immobilier au Maroc · WhatsApp / Tél. : ${TEL_MAROC}` : r.signature) || "";

async function creerScript(admin: any, orgId: string, signature: string, decalage = 0, choix: Choix = {}, marche: Marche = "quebec") {
  const { data: recents } = await admin.from("reel_scripts").select("ville, public_cible, type, titre")
    .eq("organization_id", orgId).eq("marche", marche).in("type", ["conseil", "nouveaute"]).order("created_at", { ascending: false }).limit(30);
  const sujet = choisirSujet(recents || [], numeroJour() + decalage, marche);
  if (choix.publicCible) sujet.publicCible = choix.publicCible;
  if (choix.type) sujet.type = choix.type;
  const s = await genererScript(await secret(admin, "anthropic_api_key"), sujet, signature, (recents || []).map((r: { titre: string }) => r.titre).filter(Boolean), marche);
  const { data, error } = await admin.from("reel_scripts").insert({
    organization_id: orgId, marche, script_date: today(), ville: sujet.ville, public_cible: sujet.publicCible, type: sujet.type,
    titre: s.titre, accroche: s.accroche, parties: s.parties, duree_secondes: s.duree_secondes,
    conseils_tournage: s.conseils_tournage, legende: s.legende, sources: s.sources,
  }).select().single();
  if (error) throw new Error("Enregistrement : " + error.message);
  return data;
}

// Reel ciblé (Québec : les acheteurs du CRM sont au Québec)
async function creerScriptCible(admin: any, orgId: string, signature: string, pub: Public, type: string, filtres: { secteur?: string; budget?: string }) {
  const demande = await demandeAcheteurs(admin, orgId, type, filtres);
  if (pub === "vendeurs") exigerAcheteurs(demande);
  const typeReel = typeContenuDe(pub);
  const { data: recents } = await admin.from("reel_scripts").select("titre")
    .eq("organization_id", orgId).eq("type", typeReel).order("created_at", { ascending: false }).limit(15);
  const s = await genererReelCible(await secret(admin, "anthropic_api_key"), pub, demande, signature, (recents || []).map((r: { titre: string }) => r.titre).filter(Boolean));
  const { data, error } = await admin.from("reel_scripts").insert({
    organization_id: orgId, marche: "quebec", script_date: today(), ville: s.zone,
    public_cible: pub === "vendeurs" ? "propriétaires vendeurs" : `acheteurs de ${demande.libelle}`, type: typeReel,
    cible: cibleDe(pub, demande, s.zone),
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
    const body = await req.json().catch(() => ({}));
    const cronHeader = req.headers.get("x-cron-secret");
    if (cronHeader) {
      if (cronHeader !== (await secret(admin, "content_cron_secret"))) return json({ error: "Non autorisé" }, 401);
      // Un script par marché chaque matin (ou seulement ceux de body.marches)
      const marches = Array.isArray(body.marches) ? MARCHES.filter((m) => body.marches.includes(m)) : MARCHES;
      const { data: orgs } = await admin.from("content_settings").select("organization_id, signature, signature_maroc").eq("enabled", true);
      const resultats = [];
      for (const org of (orgs || []) as Reglages[]) {
        for (const marche of marches) {
          // Les reels ciblés ne remplacent pas le script du jour
          const { data: existant } = await admin.from("reel_scripts").select("id")
            .eq("organization_id", org.organization_id).eq("marche", marche).eq("script_date", today())
            .in("type", ["conseil", "nouveaute"]).neq("status", "refuse").limit(1);
          if (existant?.length) { resultats.push({ org: org.organization_id, marche, statut: "déjà généré" }); continue; }
          try {
            const s = await creerScript(admin, org.organization_id, signatureDe(org, marche), 0, {}, marche);
            resultats.push({ org: org.organization_id, marche, statut: "généré", id: s.id, ville: s.ville });
          } catch (err) {
            console.error(`Script impossible (${marche}) :`, String(err));
            resultats.push({ org: org.organization_id, marche, statut: "erreur", erreur: String(err) });
          }
        }
      }
      return json({ resultats });
    }

    // Propriétaire de l'agence (RLS)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: reglages } = await userClient.from("content_settings").select("organization_id, signature, signature_maroc").maybeSingle();
    if (!reglages) return json({ error: "Réservé au propriétaire de l'agence" }, 403);
    if (body.remplacer) {
      await admin.from("reel_scripts").update({ status: "refuse" })
        .eq("id", body.remplacer).eq("organization_id", reglages.organization_id).eq("status", "propose");
    }

    if (body.type === "recherche" || body.type === "acheteurs") {
      const pub: Public = body.type === "recherche" ? "vendeurs" : "acheteurs";
      const type = estTypeRecherche(body.type_propriete) ? body.type_propriete : "duplex";
      const filtres = {
        secteur: typeof body.secteur === "string" ? body.secteur.slice(0, 80) : undefined,
        budget: typeof body.budget === "string" ? body.budget.slice(0, 60) : undefined,
      };
      const script = await creerScriptCible(admin, reglages.organization_id, signatureDe(reglages as Reglages, "quebec"), pub, type, filtres);
      return json({ script });
    }

    const marche: Marche = estMarche(body.marche) ? body.marche : "quebec";
    const choix: Choix = {};
    if (typeof body.public === "string" && publicsDe(marche).includes(body.public)) choix.publicCible = body.public;
    if (body.type === "conseil" || body.type === "nouveaute") choix.type = body.type;
    // « Autre script » sans choix : on décale la rotation pour changer de public et de type
    const decalage = body.remplacer && !choix.publicCible && !choix.type ? Math.floor(Math.random() * 3) + 1 : 0;
    const script = await creerScript(admin, reglages.organization_id, signatureDe(reglages as Reglages, marche), decalage, choix, marche);
    return json({ script });
  } catch (err) {
    console.error(err);
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
