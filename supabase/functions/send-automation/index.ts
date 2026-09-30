import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentification requise" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Session invalide" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { contactId, ruleId } = await request.json();
    const { data: profile } = await admin.from("profiles").select("organization_id").eq("id", user.id).single();
    const { data: contact } = await admin.from("contacts").select("*").eq("id", contactId).eq("organization_id", profile?.organization_id).single();
    const { data: rule } = await admin.from("automation_rules").select("*").eq("id", ruleId).eq("organization_id", profile?.organization_id).single();
    if (!profile || !contact || !rule || !rule.active) return json({ error: "Règle ou contact indisponible" }, 404);
    const hasConsent = !contact.unsubscribed_at && (rule.channel === "email" ? contact.consent_email : contact.consent_sms);
    if (rule.consent_required && !hasConsent) {
      await admin.from("message_logs").insert({ organization_id: profile.organization_id, rule_id: rule.id, contact_id: contact.id, channel: rule.channel, provider: rule.channel === "email" ? "resend" : "twilio", status: "blocked", body: rule.template, error: "Consentement absent" });
      return json({ error: "Envoi bloqué : consentement absent" }, 403);
    }
    let body = rule.template.replaceAll("{{prenom}}", contact.full_name.split(" ")[0]).replaceAll("{{nom}}", contact.full_name);
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    if (rule.ai_enabled && openAiKey) {
      try {
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.4,
            max_tokens: rule.channel === "sms" ? 120 : 300,
            messages: [
              { role: "system", content: "Tu es l’assistant automatisé d’une agence immobilière. Personnalise le modèle sans inventer d’information, sans pression commerciale, et indique clairement que le message est automatisé. Réponds uniquement avec le message final en français." },
              { role: "user", content: `Canal: ${rule.channel}. Contact: ${contact.full_name}. Projet: ${contact.project}. Modèle: ${body}` },
            ],
          }),
        });
        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          body = aiResult.choices?.[0]?.message?.content?.trim() || body;
        }
      } catch {
        // Le modèle déterministe reste utilisé si le fournisseur IA est indisponible.
      }
    }
    if (rule.channel === "sms" && !body.toUpperCase().includes("STOP")) body += " Répondez STOP pour vous désinscrire.";
    let providerId = "";
    if (rule.channel === "email") {
      const key = Deno.env.get("RESEND_API_KEY"); const from = Deno.env.get("RESEND_FROM_EMAIL");
      if (!key || !from) return json({ error: "Configuration Resend requise" }, 503);
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: contact.email, subject: rule.name, text: body }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "Échec Resend"); providerId = result.id;
    } else {
      const sid = Deno.env.get("TWILIO_ACCOUNT_SID"); const token = Deno.env.get("TWILIO_AUTH_TOKEN"); const from = Deno.env.get("TWILIO_FROM_NUMBER");
      if (!sid || !token || !from) return json({ error: "Configuration Twilio requise" }, 503);
      const params = new URLSearchParams({ To: contact.phone, From: from, Body: body });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params });
      const result = await response.json(); if (!response.ok) throw new Error(result.message ?? "Échec Twilio"); providerId = result.sid;
    }
    await admin.from("message_logs").insert({ organization_id: profile.organization_id, rule_id: rule.id, contact_id: contact.id, channel: rule.channel, provider: rule.channel === "email" ? "resend" : "twilio", status: "sent", body, sent_at: new Date().toISOString() });
    return json({ sent: true, providerId });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Erreur serveur" }, 500); }
});
