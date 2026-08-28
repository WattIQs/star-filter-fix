import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const Route = createFileRoute("/api/auth/verify-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);

        const body = await request.json().catch(() => null) as { code?: string } | null;
        const code = body?.code?.trim() ?? "";
        if (!/^\d{6}$/.test(code)) return json({ error: "Digite o código de 6 dígitos." }, 400);

        const url = process.env.VITE_SUPABASE_URL;
        const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return json({ error: "Supabase não está configurado no servidor." }, 500);

        const supabase = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader } },
        });

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

        const { data: verified, error } = await supabase.rpc("verify_email_code", { p_code: code });
        if (error) return json({ error: "Não foi possível validar o código." }, 500);
        if (!verified) return json({ error: "Código inválido, expirado ou com tentativas excedidas." }, 400);

        return json({ ok: true });
      },
    },
  },
});
