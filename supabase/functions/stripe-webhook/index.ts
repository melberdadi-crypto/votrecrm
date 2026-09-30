import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

Deno.serve(async (request) => {
  const key = Deno.env.get("STRIPE_SECRET_KEY"); const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!key || !secret) return new Response("Stripe non configuré", { status: 503 });
  const stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" });
  try {
    const rawBody = await request.text(); const signature = request.headers.get("stripe-signature");
    if (!signature) return new Response("Signature absente", { status: 400 });
    const event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      const subscription = event.data.object as Stripe.Subscription;
      const organizationId = subscription.metadata.organization_id; if (!organizationId) throw new Error("Organisation absente");
      await admin.from("subscriptions").upsert({ organization_id: organizationId, stripe_customer_id: String(subscription.customer), stripe_subscription_id: subscription.id, plan: subscription.metadata.plan ?? "trial", billing_interval: subscription.metadata.interval ?? "monthly", status: subscription.status, period_end: new Date(subscription.current_period_end * 1000).toISOString() }, { onConflict: "organization_id" });
    }
    return new Response("ok");
  } catch (error) { return new Response(error instanceof Error ? error.message : "Webhook invalide", { status: 400 }); }
});
