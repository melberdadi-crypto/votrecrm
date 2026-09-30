import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const base64 = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

Deno.serve(async (request) => {
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const webhookUrl = Deno.env.get("TWILIO_WEBHOOK_URL");
  const receivedSignature = request.headers.get("x-twilio-signature");

  if (!token || !webhookUrl || !receivedSignature) {
    return new Response("Configuration ou signature absente", {
      status: 401,
    });
  }

  const form = await request.formData();
  const entries = [...form.entries()]
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  const payload =
    webhookUrl + entries.map(([key, value]) => `${key}${value}`).join("");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const expectedSignature = base64(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payload),
    ),
  );

  if (expectedSignature !== receivedSignature) {
    return new Response("Signature invalide", { status: 403 });
  }

  const body = String(form.get("Body") ?? "").trim().toUpperCase();
  const from = String(form.get("From") ?? "");
  const stopWords = [
    "STOP",
    "ARRET",
    "ARRÊT",
    "UNSUBSCRIBE",
    "CANCEL",
    "END",
    "QUIT",
  ];

  if (stopWords.includes(body) && from) {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await admin
      .from("contacts")
      .update({
        consent_sms: false,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("phone", from);
  }

  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      headers: { "Content-Type": "text/xml" },
    },
  );
});
