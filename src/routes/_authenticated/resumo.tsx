import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { backfillTitles, getDocumentCategoryCounts, listDocuments } from "@/lib/documents.functions";
import { getDashboard } from "@/lib/dashboard.functions";
import { getCaseSummary, generateCaseSummary } from "@/lib/case-summary.functions";
import { createShare } from "@/lib/shares.functions";
import { AppShell } from "@/components/app-shell";
import { DOC_META, docTitle, formatDate, formatPersonName } from "@/lib/doc-meta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search, Share2, AlertCircle, Pill } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ShareDialog } from "@/components/share-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";

const categorySchema = z.enum(["exames", "receitas", "pedidos", "outros"]);
type Category = z.infer<typeof categorySchema>;
const categories: { value: Category | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "exames", label: "Exames e laudos" },
  { value: "receitas", label: "Receitas" },
  { value: "pedidos", label: "Pedidos e encaminhamentos" },
  { value: "outros", label: "Outros" },
];

export const Route = createFileRoute("/_authenticated/timeline")({
  validateSearch: (search): { categoria?: Category } => {
    const parsed = categorySchema.safeParse(search.categoria);
    return parsed.success ? { categoria: parsed.data } : {};
  },
  head: () => ({
    meta: [
      { title: "Início — Meddocs" },
      { name: "description", content: "Resumo da sua saúde e todos os seus documentos num só lugar." },
      { property: "og:title", content: "Início — Meddocs" },
      { property: "og:description", content: "Resumo da sua saúde e todos os seus documentos num só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TimelinePage,
});

type DocRow = {
  id: string;
  doc_type: keyof typeof DOC_META;
  doc_date: string | null;
  doctor_name: string | null;
  title: string | null;
  summary: string | null;
  confidence: "high" | "review";
  cid: string | null;
  created_at: string;
};

type MedRow = { name: string; dosage: string | null; route: string | null; document_id: string };

function TimelinePage() {
  const { categoria } = Route.useSearch();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // Espera a pessoa parar de digitar (300ms) antes de buscar
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  const qc = useQueryClient();
  const list = useServerFn(listDocuments);
  const getCounts = useServerFn(getDocumentCategoryCounts);
  const dash = useServerFn(getDashboard);
  const backfill = useServerFn(backfillTitles);
  const createShareFn = useServerFn(createShare);
  const getCase = useServerFn(getCaseSummary);
  const generateCase = useServerFn(generateCaseSummary);
  const [includeSummary, setIncludeSummary] = useState(false);
  const [shareChoiceOpen, setShareChoiceOpen] = useState(false);
  const { data: caseData } = useQuery({ queryKey: ["case-summary"], queryFn: () => getCase() });
  // Resumo do caso: atualiza sozinho quando não existe ou quando algo mudou.
  // Tenta uma vez por visita; se falhar, mostra o erro na tela com "Tentar novamente".
  const regenerate = useMutation({
    mutationFn: () => generateCase(),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["case-summary"] }); },
  });
  const autoTried = useRef(false);
  useEffect(() => {
    if (!caseData || autoTried.current || regenerate.isPending) return;
    if (caseData.hasDocuments && (!caseData.summary || caseData.stale)) {
      autoTried.current = true;
      regenerate.mutate();
    }
  }, [caseData, regenerate]);

  const { data: dashData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dash(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["documents", search, categoria],
    queryFn: () => list({ data: { search: search || undefined, category: categoria } }),
    placeholderData: (prev) => prev,
  });

  const { data: counts } = useQuery({
    queryKey: ["document-category-counts"],
    queryFn: () => getCounts(),
  });

  useEffect(() => {
    if (categoria && counts && counts[categoria] === 0) {
      void navigate({ to: "/timeline", search: {}, replace: true });
    }
  }, [categoria, counts, navigate]);

  const backfillStarted = useRef(false);
  useEffect(() => {
    if (backfillStarted.current || !data?.some((doc) => !doc.title)) return;
    backfillStarted.current = true;
    void backfill().then(() => {
      void qc.invalidateQueries({ queryKey: ["documents"] });
    });
  }, [backfill, data, qc]);

  const [shareState, setShareState] = useState<{ open: boolean; token?: string; expiresAt?: string | null }>({ open: false });
  const shareAll = useMutation({
    mutationFn: (ttl_hours: number) => createShareFn({ data: { scope: "all", ttl_hours, include_case_summary: includeSummary } }),
    onSuccess: (row) => { setShareChoiceOpen(false); setShareState({ open: true, token: row.token, expiresAt: row.expires_at }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const firstName = dashData?.fullName ? dashData.fullName.trim().split(/\s+/)[0] : null;

  const diseases = caseData?.summary?.content.diagnosis ?? [];

  // Medicamentos em uso: das receitas, um cartão por remédio (o mais recente prevalece)
  const meds = useMemo(() => {
    const map = new Map<string, MedRow>();
    for (const med of (dashData?.meds ?? []) as MedRow[]) {
      const key = med.name.trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, { ...med, name: med.name.trim() });
    }
    return [...map.values()];
  }, [dashData]);

  const hasAnyDocs = (dashData?.docs?.length ?? 0) > 0;

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl">{firstName ? `Olá, ${firstName}` : "Início"}</h1>
        <Button variant="outline" size="sm" onClick={() => setShareChoiceOpen(true)} disabled={shareAll.isPending}>
          <Share2 className="size-4" />
          <span className="hidden sm:inline">Compartilhar tudo</span>
        </Button>
      </div>

      {caseData?.hasDocuments && (
        <section className="mb-6 rounded-2xl border border-border bg-card p-4 space-y-2" aria-label="Resumo do caso">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg">Resumo do caso</h2>
            {caseData.summary && (
              <Link to="/resumo" className="shrink-0 text-sm font-medium text-primary underline underline-offset-4">Ver mais</Link>
            )}
          </div>
          {caseData.summary ? (
            <p className="line-clamp-2 text-foreground">
              {caseData.summary.content.headline}
              {caseData.summary.content.current_treatment ? ` ${caseData.summary.content.current_treatment.text}` : ""}
            </p>
          ) : regenerate.isPending ? (
            <p className="text-sm text-muted-foreground">Montando o resumo a partir dos seus documentos. Isso pode levar até 1 minuto…</p>
          ) : null}
          {caseData.summary && (
            <p className="text-xs text-muted-foreground">
              {regenerate.isPending ? "Atualizando com as novidades…" : `Atualizado em ${formatDate(caseData.summary.created_at)}`}
            </p>
          )}
          {regenerate.isError && !regenerate.isPending && (
            <p className="text-sm text-destructive">
              Não foi possível atualizar o resumo: {(regenerate.error as Error).message}{" "}
              <button type="button" className="underline underline-offset-4" onClick={() => regenerate.mutate()}>Tentar novamente</button>
            </p>
          )}
        </section>
      )}

      {hasAnyDocs && (
        <section aria-label="Condições ativas" className="mb-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Condições ativas</h2>
          {diseases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum diagnóstico identificado no resumo ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {diseases.map((d, index) => (
                <Link
                  key={`${d.text}-${index}`}
                  to="/documents/$id"
                  params={{ id: d.sources.find((source) => source !== "family") ?? "" }}
                  search={categoria ? { categoria } : {}}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-secondary/40"
                >
                  <span className="font-medium text-foreground">{d.text}</span>
                  <span className="text-muted-foreground">{d.cid ? `CID ${d.cid}` : d.cid_is_suggested ? "CID sugerido" : ""}</span>
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
                  search={categoria ? { categoria } : {}}
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

      <h2 className="text-sm font-medium text-muted-foreground mb-2">Documentos</h2>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar exame, médico ou remédio"
          aria-label="Buscar documentos"
          className="pl-9 h-11"
        />
      </div>

      <nav aria-label="Filtrar documentos por categoria" className="mb-4 -mx-4 px-4 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max min-w-full gap-2 pb-1">
          {categories.filter((item) => item.value === "todos" || !counts || counts[item.value] > 0).map((item) => {
            const active = (categoria ?? "todos") === item.value;
            return (
              <Button
                key={item.value}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                aria-pressed={active}
                onClick={() => void navigate({ to: "/timeline", search: item.value === "todos" ? {} : { categoria: item.value } })}
                className="shrink-0 rounded-full gap-2"
              >
                {item.label}
                <span className={active ? "text-primary-foreground/80 tabular-nums" : "text-muted-foreground tabular-nums"}>
                  {counts?.[item.value] ?? "–"}
                </span>
              </Button>
            );
          })}
        </div>
      </nav>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState hasSearch={!!search} hasCategory={!!categoria} />
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
                  search={categoria ? { categoria } : {}}
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
                    <p className="mt-0.5 font-medium text-foreground line-clamp-1">
                      <Highlight text={docTitle(doc.title, doc.summary)} query={search} />
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(doc.doc_date ?? doc.created_at)}
                      {doc.doctor_name ? ` · ${formatPersonName(doc.doctor_name)}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <FloatingAddButton />
      {shareChoiceOpen && <div role="dialog" aria-modal="true" aria-label="Compartilhar tudo" className="fixed inset-0 z-50 bg-foreground/30 flex items-center justify-center p-4"><div className="bg-card border border-border p-5 w-full max-w-sm space-y-4 shadow-lg"><h2 className="text-xl">Compartilhar tudo</h2><label className="flex gap-3 items-center text-sm"><Checkbox checked={includeSummary} onCheckedChange={(value) => setIncludeSummary(value === true)} />Incluir resumo do caso</label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShareChoiceOpen(false)}>Cancelar</Button><Button disabled={shareAll.isPending} onClick={() => shareAll.mutate(24)}>Gerar link</Button></div></div></div>}
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

// Destaca no título as palavras buscadas, ignorando acentos e maiúsculas
function foldForSearch(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = foldForSearch(query).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  if (tokens.length === 0) return <>{text}</>;

  // Versão "dobrada" do texto, guardando a posição de cada letra no original
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    for (const ch of foldForSearch(text[i])) {
      folded += /[a-z0-9]/.test(ch) ? ch : " ";
      map.push(i);
    }
  }

  const marked = new Array<boolean>(text.length).fill(false);
  for (const t of tokens) {
    let from = 0;
    for (;;) {
      const at = folded.indexOf(t, from);
      if (at === -1) break;
      for (let k = at; k < at + t.length; k++) marked[map[k]] = true;
      from = at + t.length;
    }
  }

  const parts: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.hit === marked[i]) last.text += text[i];
    else parts.push({ text: text[i], hit: marked[i] });
  }
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-primary/15 text-foreground">{p.text}</mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function EmptyState({ hasSearch, hasCategory }: { hasSearch: boolean; hasCategory: boolean }) {
  if (hasSearch || hasCategory) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        Nenhum documento encontrado {hasSearch ? "para essa busca" : "nesta categoria"}.
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
