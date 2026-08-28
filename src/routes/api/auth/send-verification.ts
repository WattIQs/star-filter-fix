import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function hashCode(code: string) {
  const bytes = new TextEncoder().encode(code);
  return crypto.subtle.digest("SHA-256", bytes).then((buffer) =>
    Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const Route = createFileRoute("/api/auth/send-verification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);

        const url = process.env.VITE_SUPABASE_URL;
        const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const brevoKey = process.env.BREVO_API_KEY;
        const senderEmail = process.env.BREVO_SENDER_EMAIL;
        const senderName = process.env.BREVO_SENDER_NAME || "Star Filter";
        if (!url || !key) return json({ error: "Supabase não está configurado no servidor." }, 500);
        if (!brevoKey || !senderEmail) return json({ error: "Brevo não está configurado. Adicione BREVO_API_KEY e BREVO_SENDER_EMAIL no Render." }, 500);

        const supabase = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader } },
        });

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user?.email) return json({ error: "Sessão inválida ou expirada." }, 401);

        const email = userData.user.email;
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const codeHash = await hashCode(code);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const { error: saveError } = await supabase.from("email_verification_codes").upsert({
          user_id: userData.user.id,
          code_hash: codeHash,
          expires_at: expiresAt,
          attempts: 0,
        });
        if (saveError) return json({ error: "Não foi possível preparar a confirmação." }, 500);

        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": brevoKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { email: senderEmail, name: senderName },
            to: [{ email }],
            subject: "Seu código de confirmação — Star Filter",
            htmlContent: `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#171717"><div style="max-width:560px;margin:0 auto;padding:32px"><h1>Confirme seu e-mail</h1><p>Use o código abaixo para confirmar sua conta no Star Filter:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:20px 0">${code}</div><p>Este código expira em 10 minutos.</p><p>Se você não criou esta conta, ignore este e-mail.</p></div></body></html>`,
          }),
        });

        if (!brevoResponse.ok) {
          await supabase.from("email_verification_codes").delete().eq("user_id", userData.user.id);
          return json({ error: "O Brevo não conseguiu enviar o e-mail. Verifique o remetente configurado." }, 502);
        }

        return json({ ok: true });
      },
    },
  },
});
