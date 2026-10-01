// Publication d'un Reel monté dans le CRM (Monteur Reels) sur Instagram et Facebook.
// Actions : legendes, url_televersement, publier, statut, finaliser.
// Réservé au propriétaire de l'agence (vérifié par RLS sur content_settings).
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GRAPH_VERSION = "v26.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const BUCKET = "content-videos";
const SITE_TEXTE = "www.mohamedelberhdadi.ca";
const SITE_URL = "https://www.mohamedelberhdadi.ca";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Admin = ReturnType<typeof createClient>;

async function secret(admin: Admin, name: string) {
  const { data, error } = await admin.rpc("get_app_secret", { secret_name: name });
  if (error || !data) throw new Error(`Secret ${name} introuvable`);
  return data as string;
}

async function graph(path: string, params: Record<string, string>, method = "POST") {
  const res = method === "GET"
    ? await fetch(`${GRAPH}/${path}?${new URLSearchParams(params)}`)
    : await fetch(`${GRAPH}/${path}`, { method: "POST", body: new URLSearchParams(params) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `Erreur Meta ${res.status}`);
  return data;
}

function messageMeta(plateforme: string, err: unknown) {
  const m = String((err as Error)?.message || err);
  if (/pages_manage_posts|permission|App Review|\(#200\)|\(#10\)/i.test(m)) {
    return `${plateforme} n'autorise pas encore la publication automatique pour votre application Meta (permission « pages_manage_posts » à faire approuver). Publiez la vidéo manuellement sur Facebook : le texte est prêt à copier.`;
  }
  if (/token|session|expired|OAuthException/i.test(m)) return `${plateforme} : la connexion Meta a expiré. Il faut renouveler le jeton de la page.`;
  return `${plateforme} : ${m}`;
}

// Garantit la présence du site dans chaque texte
function avecSite(texte: string, plateforme: "instagram" | "facebook", signature: string) {
  let t = (texte || "").trim();
  if (!/mohamedelberhdadi\.ca/i.test(t)) {
    const ligne = plateforme === "instagram"
      ? `👉 Tous mes conseils et outils gratuits : ${SITE_TEXTE} (lien dans la bio)`
      : `👉 Tous mes conseils et outils gratuits : ${SITE_URL}`;
    t = t ? `${t}\n\n${ligne}` : ligne;
  }
  if (signature && !t.includes(signature)) t += `\n\n${signature}`;
  return t.slice(0, 2150);
}

function legendesSecours(texte: string, signature: string) {
  const phrase = (texte.match(/[^.!?]+[.!?]/) || [texte])[0].trim().slice(0, 160);
  const base = `${phrase}\n\nVous voulez aller plus loin ? Calculateurs, guides des quartiers de Laval et évaluation gratuite de votre propriété vous attendent sur mon site.`;
  return {
    instagram: avecSite(`${base}\n\n👉 ${SITE_TEXTE} (lien dans la bio)\n\n#Laval #ImmobilierLaval #CourtierImmobilier #PremierAchat #Québec`, "instagram", signature),
    facebook: avecSite(`${base}\n\n👉 ${SITE_URL}`, "facebook", signature),
    secours: true,
  };
}

async function legendes(admin: Admin, texte: string, signature: string) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": await secret(admin, "anthropic_api_key"), "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1500,
        thinking: { type: "disabled" },
        system:
          "Tu rédiges les textes de publication des Reels de Mohamed El Berhdadi, courtier immobilier résidentiel à Laval (Vendirect inc.). " +
          "Français québécois, VOUVOIEMENT, ton chaleureux, clair et professionnel. N'invente aucun chiffre absent de la transcription. " +
          "L'objectif principal : donner envie de visiter son site web. Réponds UNIQUEMENT avec un objet JSON valide.",
        messages: [{
          role: "user",
          content:
            `Transcription du Reel :\n"""${texte.slice(0, 6000)}"""\n\n` +
            `Rends ce JSON :\n{\n` +
            `  "instagram": "légende de 50 à 110 mots : 1re ligne accrocheuse, 2 ou 3 phrases qui résument l'essentiel, puis un appel à l'action CLAIR et explicite invitant à visiter le site ${SITE_TEXTE} (préciser « lien dans la bio », car les liens ne sont pas cliquables sur Instagram), puis une ligne vide, exactement : ${signature}, puis une ligne vide et 4 à 6 hashtags pertinents (#Laval, #ImmobilierLaval...)",\n` +
            `  "facebook": "publication de 50 à 120 mots : 1re ligne accrocheuse, résumé, puis un appel à l'action CLAIR invitant à cliquer sur ${SITE_URL} (lien complet), puis une ligne vide et exactement : ${signature}"\n}`,
        }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 200));
    const raw = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
    const obj = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    if (typeof obj.instagram !== "string" || typeof obj.facebook !== "string") throw new Error("JSON incomplet");
    return { instagram: avecSite(obj.instagram, "instagram", signature), facebook: avecSite(obj.facebook, "facebook", signature), secours: false };
  } catch (err) {
    console.error("Légendes IA indisponibles, texte de secours :", String(err));
    return legendesSecours(texte, signature);
  }
}

async function publierFacebookReel(pageId: string, token: string, videoUrl: string, description: string) {
  const debut = await graph(`${pageId}/video_reels`, { upload_phase: "start", access_token: token });
  const videoId = String(debut.video_id);
  const up = await fetch(`https://rupload.facebook.com/video-upload/${GRAPH_VERSION}/${videoId}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_url: videoUrl },
  });
  const upData = await up.json().catch(() => ({}));
  if (!up.ok || upData.error || upData.success === false) throw new Error(upData.error?.message || upData.debug_info?.message || `Téléversement Facebook refusé (${up.status})`);
  await graph(`${pageId}/video_reels`, { upload_phase: "finish", video_id: videoId, video_state: "PUBLISHED", description, access_token: token });
  return videoId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: reglagesUser } = await userClient.from("content_settings").select("organization_id").maybeSingle();
    if (!reglagesUser?.organization_id) return json({ error: "Réservé au propriétaire de l'agence" }, 403);
    const orgId = reglagesUser.organization_id as string;
    const { data: reglages } = await admin.from("content_settings").select("ig_user_id, fb_page_id, signature").eq("organization_id", orgId).single();
    const signature = String(reglages?.signature || "");

    const body = await req.json().catch(() => ({}));
    const cheminValide = (p: unknown) => typeof p === "string" && p.startsWith(`${orgId}/reels/`) && p.endsWith(".mp4");

    switch (body.action) {
      case "legendes":
        return json({ ...(await legendes(admin, String(body.texte || ""), signature)), instagram_actif: Boolean(reglages?.ig_user_id), facebook_actif: Boolean(reglages?.fb_page_id) });

      case "url_televersement": {
        const path = `${orgId}/reels/${crypto.randomUUID()}.mp4`;
        const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
        if (error) throw error;
        return json({ path, token: data.token });
      }

      case "publier": {
        if (!cheminValide(body.path)) return json({ error: "Vidéo introuvable" }, 400);
        const token = await secret(admin, "meta_page_token");
        const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(body.path);
        const resultat: { instagram?: { creation_id: string }; facebook?: { video_id: string }; erreurs: Record<string, string> } = { erreurs: {} };
        if (body.instagram) {
          if (!reglages?.ig_user_id) resultat.erreurs.instagram = "Compte Instagram non relié au CRM.";
          else {
            try {
              const c = await graph(`${reglages.ig_user_id}/media`, {
                media_type: "REELS", video_url: pub.publicUrl, caption: avecSite(String(body.legende_instagram || ""), "instagram", signature), share_to_feed: "true", access_token: token,
              });
              resultat.instagram = { creation_id: String(c.id) };
            } catch (err) { resultat.erreurs.instagram = messageMeta("Instagram", err); }
          }
        }
        if (body.facebook) {
          if (!reglages?.fb_page_id) resultat.erreurs.facebook = "Page Facebook non reliée au CRM.";
          else {
            try { resultat.facebook = { video_id: await publierFacebookReel(reglages.fb_page_id, token, pub.publicUrl, avecSite(String(body.legende_facebook || ""), "facebook", signature)) }; }
            catch (err) { resultat.erreurs.facebook = messageMeta("Facebook", err); }
          }
        }
        return json(resultat);
      }

      case "statut": {
        const token = await secret(admin, "meta_page_token");
        const etat = await graph(String(body.creation_id), { fields: "status_code,status", access_token: token }, "GET");
        return json({ statut: etat.status_code, detail: etat.status });
      }

      case "finaliser": {
        if (!reglages?.ig_user_id) return json({ error: "Compte Instagram non relié au CRM." }, 400);
        const token = await secret(admin, "meta_page_token");
        const publie = await graph(`${reglages.ig_user_id}/media_publish`, { creation_id: String(body.creation_id), access_token: token });
        let permalink = "";
        try { permalink = (await graph(String(publie.id), { fields: "permalink", access_token: token }, "GET")).permalink || ""; } catch { /* lien facultatif */ }
        return json({ media_id: publie.id, permalink });
      }

      default:
        return json({ error: "Action inconnue" }, 400);
    }
  } catch (err) {
    console.error(err);
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
