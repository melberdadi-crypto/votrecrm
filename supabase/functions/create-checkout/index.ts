import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const prices: Record<string, string | undefined> = {
  "solo-monthly": Deno.env.get("STRIPE_PRICE_SOLO_MONTHLY"), "solo-yearly": Deno.env.get("STRIPE_PRICE_SOLO_YEARLY"),
  "agency-monthly": Deno.env.get("STRIPE_PRICE_AGENCY_MONTHLY"), "agency-yearly": Deno.env.get("STRIPE_PRICE_AGENCY_YEARLY"),
  "pro_ai-monthly": Deno.env.get("STRIPE_PRICE_PRO_AI_MONTHLY"), "pro_ai-yearly": Deno.env.get("STRIPE_PRICE_PRO_AI_YEARLY"),
};
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authorization = request.headers.get("Authorization"); if (!authorization) return json({ error: "Authentification requise" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser(); if (!user) return json({ error: "Session invalide" }, 401);
    const { plan, interval, returnUrl } = await request.json();
    const price = prices[`${plan}-${interval}`]; if (!price) return json({ error: "Prix Stripe non configuré" }, 503);
    const { data: profile } = await userClient.from("profiles").select("organization_id").single(); if (!profile) return json({ error: "Agence introuvable" }, 404);
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY"); if (!stripeKey) return json({ error: "Configuration Stripe requise" }, 503);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
    const checkout = await stripe.checkout.sessions.create({ mode: "subscription", customer_email: user.email, line_items: [{ price, quantity: 1 }], metadata: { organization_id: profile.organization_id, plan, interval }, success_url: `${returnUrl}?checkout=success`, cancel_url: `${returnUrl}?checkout=cancelled`, subscription_data: { metadata: { organization_id: profile.organization_id, plan, interval } } });
    return json({ url: checkout.url });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Erreur Stripe" }, 500); }
});
