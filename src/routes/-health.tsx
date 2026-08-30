import { useNavigate } from "@tanstack/react-router";

export function HealthPage() {
  const navigate = useNavigate();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="rounded-xl border border-border px-6 py-4 text-center">
        <strong>ok</strong>
        <p className="mt-1 text-sm text-muted-foreground">Sinal Zero application is running.</p>
        <button type="button" className="mt-4 rounded-md border px-3 py-2 text-sm" onClick={() => navigate({ to: "/" })}>
          Voltar
        </button>
      </div>
    </main>
  );
}
