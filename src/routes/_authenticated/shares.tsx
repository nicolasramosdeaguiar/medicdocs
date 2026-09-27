import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useServerFn } from "@tanstack/react-start";
import { listShares, revokeShare } from "@/lib/shares.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Ban } from "lucide-react";
import { formatDate } from "@/lib/doc-meta";

export const Route = createFileRoute("/_authenticated/shares")({
  head: () => ({ meta: [
    { title: "Links ativos — Meddocs" },
    { name: "description", content: "Gerencie os links temporários dos seus documentos de saúde." },
    { property: "og:title", content: "Links ativos — Meddocs" },
    { property: "og:description", content: "Gerencie os links temporários dos seus documentos de saúde." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SharesPage,
});

function SharesPage() {
  const list = useServerFn(listShares);
  const revoke = useServerFn(revokeShare);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["shares"], queryFn: () => list() });

  const rev = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => { toast.success("Link revogado"); qc.invalidateQueries({ queryKey: ["shares"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="text-2xl mb-1">Links de compartilhamento</h1>
      <p className="text-muted-foreground mb-6">Você pode revogar qualquer link a qualquer momento.</p>

      {isLoading ? (
        <div className="h-24 rounded-xl bg-muted/50 animate-pulse" />
      ) : !data || data.length === 0 ? (
        <p className="text-muted-foreground">Você ainda não gerou nenhum link.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((s) => {
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/s/${s.token}`;
            const isRevoked = !!s.revoked_at;
            const isExpired = s.expires_at ? new Date(s.expires_at).getTime() < Date.now() : false;
            const active = !isRevoked && !isExpired;
            return (
              <li key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {s.scope === "all" ? "Todos os documentos" : "Documento específico"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Criado em {formatDate(s.created_at)}
                      {s.expires_at ? ` · expira em ${formatDate(s.expires_at)}` : " · sem expiração"}
                    </p>
                    <p className="text-xs mt-1">
                      Status:{" "}
                      <span className={active ? "text-primary" : "text-muted-foreground"}>
                        {isRevoked ? "revogado" : isExpired ? "expirado" : "ativo"}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {active && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}>
                          <Copy className="size-4" /> Copiar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => rev.mutate(s.id)}>
                          <Ban className="size-4" /> Revogar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {active && <p className="mt-2 text-xs text-muted-foreground truncate">{url}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
