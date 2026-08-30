import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/health")({ component: HealthPage });

function HealthPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="rounded-xl border border-border px-6 py-4 text-center">
        <strong>ok</strong>
        <p className="mt-1 text-sm text-muted-foreground">Sinal Zero application is running.</p>
      </div>
    </main>
  );
}
