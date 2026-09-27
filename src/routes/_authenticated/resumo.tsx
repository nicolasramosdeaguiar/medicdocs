import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CaseSummaryView } from "@/components/case-summary-view";
import { getCaseSummary, saveCaseNotes, generateCaseSummary } from "@/lib/case-summary.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  const make = useMutation({ mutationFn: () => generate(), onSuccess: () => { toast.success("Resumo atualizado"); void qc.invalidateQueries({ queryKey: ["case-summary"] }); }, onError: (e: Error) => toast.error(e.message) });
  return <AppShell>
    <Button variant="ghost" size="sm" asChild><Link to="/timeline" search={{}}><ArrowLeft className="size-4" /> Início</Link></Button>
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 mb-6"><h1 className="text-2xl">Resumo do caso</h1><Button variant="outline" onClick={() => setEditing(!editing)}>Editar informações da família</Button></div>
    {editing && <div className="border border-border bg-card p-4 space-y-4 mb-6">{fields.map((field) => <div key={field.key} className="space-y-1"><Label htmlFor={field.key}>{field.label}</Label><Textarea id={field.key} value={notes[field.key] ?? ""} onChange={(e) => setNotes({ ...notes, [field.key]: e.target.value || null })} /></div>)}<Button disabled={write.isPending} onClick={() => write.mutate()}>{write.isPending ? "Salvando…" : "Salvar informações"}</Button></div>}
    {isLoading ? <p>Carregando…</p> : <>
      {data?.summary && <CaseSummaryView content={data.summary.content} createdAt={data.summary.created_at} />}
      {!data?.summary && <p className="text-muted-foreground mb-4">Ainda não há um resumo gerado.</p>}
      {data?.stale && <p className="my-4 text-warning-foreground">Há documentos novos ou informações alteradas.</p>}
      {data?.hasDocuments && (!data.summary || data.stale) && <Button className="mt-5" disabled={make.isPending} onClick={() => make.mutate()}>{make.isPending ? "Gerando resumo…" : data.summary ? "Atualizar resumo" : "Gerar resumo do caso"}</Button>}
    </>}
  </AppShell>;
}