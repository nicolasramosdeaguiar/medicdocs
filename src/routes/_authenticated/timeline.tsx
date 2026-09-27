import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDocuments } from "@/lib/documents.functions";
import { getDashboard } from "@/lib/dashboard.functions";
import { createShare } from "@/lib/shares.functions";
import { AppShell } from "@/components/app-shell";
import { DOC_META, formatDate } from "@/lib/doc-meta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, Share2, AlertCircle, Pill } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShareDialog } from "@/components/share-dialog";

export const Route = createFileRoute("/_authenticated/timeline")({
  head: () => ({
    meta: [
      { title: "Início — Meddocs" },
      { name: "description", content: "Resumo da sua saúde e todos os seus documentos num só lugar." },
    ],
  }),
  component: TimelinePage,
});

type DocRow = {
  id: string;
  doc_type: keyof typeof DOC_META;
  doc_date: string | null;
  doctor_name: string | null;
  summary: string | null;
  confidence: "high" | "review";
  cid: string | null;
  created_at: string;
};

type MedRow = { name: string; dosage: string | null; route: string | null; document_id: string };

function TimelinePage() {
  const [search, setSearch] = useState("");
  const list = useServerFn(listDocuments);
  const dash = useServerFn(getDashboard);
  const createShareFn = useServerFn(createShare);

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dash(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["documents", search],
    queryFn: () => list({ data: { search: search || undefined } }),
  });

  const [shareState, setShareState] = useState<{ open: boolean; token?: string; expiresAt?: string | null }>({ open: false });
  const shareAll = useMutation({
    mutationFn: (ttl_hours: number) => createShareFn({ data: { scope: "all", ttl_hours } }),
    onSuccess: (row) => setShareState({ open: true, token: row.token, expiresAt: row.expires_at }),
    onError: (e: Error) => toast.error(e.message),
  });

  const firstName = data?.fullName ? data.fullName.trim().split(/\s+/)[0] : null;

  // Doenças ativas: CID mais recente por código, vinda dos laudos/exames
  const diseases = useMemo(() => {
    const map = new Map<string, { cid: string; summary: string | null; date: string; docId: string }>();
    for (const doc of (data?.docs ?? []) as DocRow[]) {
      const cid = doc.cid?.trim();
      if (!cid) continue;
      const key = cid.toUpperCase();
      if (!map.has(key)) {
        map.set(key, { cid: key, summary: doc.summary, date: doc.doc_date ?? doc.created_at, docId: doc.id });
      }
    }
    return [...map.values()];
  }, [data]);

  // Medicamentos em uso: das receitas, um cartão por remédio (o mais recente prevalece)
  const meds = useMemo(() => {
    const map = new Map<string, MedRow>();
    for (const med of (data?.meds ?? []) as MedRow[]) {
      const key = med.name.trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, { ...med, name: med.name.trim() });
    }
    return [...map.values()];
  }, [data]);

  const hasAnyDocs = (data?.docs?.length ?? 0) > 0;

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl">{firstName ? `Olá, ${firstName}` : "Início"}</h1>
        <Button variant="outline" size="sm" onClick={() => shareAll.mutate(24)} disabled={shareAll.isPending}>
          <Share2 className="size-4" />
          <span className="hidden sm:inline">Compartilhar tudo</span>
        </Button>
      </div>

      {hasAnyDocs && (
        <section aria-label="Condições ativas" className="mb-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Condições ativas</h2>
          {diseases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum diagnóstico (CID) identificado nos seus documentos ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {diseases.map((d) => (
                <Link
                  key={d.cid}
                  to="/documents/$id"
                  params={{ id: d.docId }}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-secondary/40"
                >
                  <span className="font-medium text-foreground">{d.cid}</span>
                  {d.summary && (
                    <span className="text-muted-foreground line-clamp-1 max-w-44 sm:max-w-56">{d.summary}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {meds.length > 0 && (
        <section aria-label="Medicamentos em uso" className="mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Medicamentos em uso</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {meds.map((med) => (
              <li key={med.name}>
                <Link
                  to="/documents/$id"
                  params={{ id: med.document_id }}
                  className="flex gap-3 items-center rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-secondary/40"
                >
                  <div className="shrink-0 size-9 rounded-lg bg-doc-prescription/12 flex items-center justify-center">
                    <Pill className="size-4 text-doc-prescription" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground line-clamp-1">{med.name}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {[med.dosage, med.route].filter(Boolean).join(" · ") || "Ver receita"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-medium text-muted-foreground">Documentos</h2>
        <div className="relative w-48 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="pl-9 h-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState hasSearch={!!search} />
      ) : (
        <ul className="space-y-3">
          {data.map((doc) => {
            const meta = DOC_META[doc.doc_type];
            const Icon = meta.icon;
            return (
              <li key={doc.id}>
                <Link
                  to="/documents/$id"
                  params={{ id: doc.id }}
                  className="flex gap-3 items-start rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40"
                >
                  <div className={`shrink-0 size-11 rounded-xl ${meta.tint} flex items-center justify-center`}>
                    <Icon className={`size-5 ${meta.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                      {doc.confidence === "review" && (
                        <span className="inline-flex items-center gap-1 text-xs text-warning-foreground bg-warning/40 rounded-full px-2 py-0.5">
                          <AlertCircle className="size-3" /> revisar
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-medium text-foreground line-clamp-2">{doc.summary || "Documento"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(doc.doc_date ?? doc.created_at)}
                      {doc.doctor_name ? ` · ${doc.doctor_name}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <FloatingAddButton />
      {shareState.open && shareState.token && (
        <ShareDialog
          open
          onOpenChange={(o) => setShareState((s) => ({ ...s, open: o }))}
          token={shareState.token}
          expiresAt={shareState.expiresAt ?? null}
        />
      )}
    </AppShell>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        Nenhum documento encontrado para essa busca.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <h2 className="text-lg">Comece adicionando seu primeiro documento</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tire uma foto ou envie um PDF de exame, receita ou laudo — a gente organiza pra você.
      </p>
      <Button asChild className="mt-4">
        <Link to="/upload"><Plus className="size-4" />Adicionar documento</Link>
      </Button>
    </div>
  );
}

function FloatingAddButton() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate({ to: "/upload" })}
      className="fixed bottom-6 right-1/2 translate-x-1/2 sm:right-6 sm:translate-x-0 h-14 pl-5 pr-6 rounded-full bg-primary text-primary-foreground shadow-lg hover:brightness-110 active:brightness-95 transition-all flex items-center gap-2 font-medium"
      aria-label="Adicionar documento"
    >
      <Plus className="size-5" />
      Adicionar documento
    </button>
  );
}
