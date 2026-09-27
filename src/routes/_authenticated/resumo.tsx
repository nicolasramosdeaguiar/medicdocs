import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CaseSummaryView } from "@/components/case-summary-view";
import { getCaseSummary, saveCaseNotes, generateCaseSummary } from "@/lib/case-summary.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import type { CaseNotes } from "@/lib/case-summary";

const fields: { key: keyof CaseNotes; label: string }[] = [
  { key: "treatment_protocol", label: "Protocolo de tratamento" }, { key: "current_cycle", label: "Ciclo atual" },
  { key: "allergies", label: "Alergias" }, { key: "next_procedure", label: "Próximo procedimento" },
  { key: "care_team_contact", label: "Contato da equipe de cuidado" }, { key: "other_notes", label: "Outras informações" },
];
const emptyNotes = Object.fromEntries(fields.map((f) => [f.key, null])) as CaseNotes;

export const Route = createFileRoute("/_authenticated/resumo")({
  head: () => ({ meta: [
    { title: "Resumo do caso — Meddocs" }, { name: "description", content: "Resumo clínico com referências aos seus documentos de saúde." },
    { property: "og:title", content: "Resumo do caso — Meddocs" }, { property: "og:description", content: "Resumo clínico com referências aos seus documentos de saúde." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }), component: SummaryPage,
});

function SummaryPage() {
  const qc = useQueryClient();
  const get = useServerFn(getCaseSummary), save = useServerFn(saveCaseNotes), generate = useServerFn(generateCaseSummary);
  const { data, isLoading } = useQuery({ queryKey: ["case-summary"], queryFn: () => get() });
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState<CaseNotes>(emptyNotes);
  useEffect(() => { if (data?.notes) setNotes(Object.fromEntries(fields.map((f) => [f.key, data.notes?.[f.key] ?? null])) as CaseNotes); }, [data?.notes]);
  const write = useMutation({ mutationFn: () => save({ data: notes }), onSuccess: () => { setEditing(false); toast.success("Informações salvas"); void qc.invalidateQueries({ queryKey: ["case-summary"] }); }, onError: (e: Error) => toast.error(e.message) });
  // Atualiza sozinho quando não existe resumo ou quando algo mudou (documentos ou informações da família)
  const make = useMutation({ mutationFn: () => generate(), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["case-summary"] }); } });
  const autoTried = useRef(false);
  useEffect(() => { autoTried.current = false; }, [data?.notes?.updated_at]);
  useEffect(() => {
    if (!data || autoTried.current || make.isPending) return;
    if (data.hasDocuments && (!data.summary || data.stale)) { autoTried.current = true; make.mutate(); }
  }, [data, make]);
  return <AppShell>
    <Button variant="ghost" size="sm" asChild><Link to="/timeline" search={{}}><ArrowLeft className="size-4" /> Início</Link></Button>
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-6"><h1 className="text-2xl">Resumo do caso</h1><Button variant="outline" onClick={() => setEditing(!editing)}>Editar informações da família</Button></div>
    {editing && <div className="border border-border bg-card p-4 space-y-4 mb-6">{fields.map((field) => <div key={field.key} className="space-y-1"><Label htmlFor={field.key}>{field.label}</Label><Textarea id={field.key} value={notes[field.key] ?? ""} onChange={(e) => setNotes({ ...notes, [field.key]: e.target.value || null })} /></div>)}<Button disabled={write.isPending} onClick={() => write.mutate()}>{write.isPending ? "Salvando…" : "Salvar informações"}</Button></div>}
    {isLoading ? <p>Carregando…</p> : <>
      {make.isPending && <p className="mb-4 text-sm text-muted-foreground">{data?.summary ? "Atualizando o resumo com as novidades…" : "Montando o resumo a partir dos seus documentos. Isso pode levar até 1 minuto…"}</p>}
      {make.isError && !make.isPending && <p className="mb-4 text-sm text-destructive">Não foi possível atualizar o resumo: {(make.error as Error).message} <button type="button" className="underline underline-offset-4" onClick={() => make.mutate()}>Tentar novamente</button></p>}
      {data?.summary && <CaseSummaryView content={data.summary.content} createdAt={data.summary.created_at} />}
      {!data?.hasDocuments && <p className="text-muted-foreground">Adicione documentos para montar o resumo do caso.</p>}
    </>}
  </AppShell>;
}
