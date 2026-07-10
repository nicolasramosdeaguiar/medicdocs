import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useServerFn } from "@tanstack/react-start";
import { getDocument, updateDocument, deleteDocument } from "@/lib/documents.functions";
import { createShare } from "@/lib/shares.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOC_TYPES, DOC_META } from "@/lib/doc-meta";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, Plus, Share2, Trash2, X } from "lucide-react";
import { z } from "zod";
import { ShareDialog } from "@/components/share-dialog";

const searchSchema = z.object({ review: z.number().optional() });

export const Route = createFileRoute("/_authenticated/documents/$id")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Documento — Meddocs" }] }),
  component: DocumentDetail,
});

type ItemDraft = {
  id?: string;
  kind: "lab" | "med";
  name: string;
  value?: string | null;
  unit?: string | null;
  reference_range?: string | null;
  dosage?: string | null;
  route?: string | null;
  notes?: string | null;
};

function DocumentDetail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const get = useServerFn(getDocument);
  const upd = useServerFn(updateDocument);
  const del = useServerFn(deleteDocument);
  const share = useServerFn(createShare);

  const { data, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => get({ data: { id } }),
  });

  const [form, setForm] = useState<{
    doc_type: (typeof DOC_TYPES)[number]["value"];
    doc_date: string;
    doctor_name: string;
    doctor_crm: string;
    requesting_doctor_name: string;
    requesting_doctor_crm: string;
    reporting_doctor_name: string;
    reporting_doctor_crm: string;
    summary: string;
    cid: string;
  } | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [shareState, setShareState] = useState<{ open: boolean; token?: string; expiresAt?: string | null }>({ open: false });

  useEffect(() => {
    if (!data) return;
    const d = data.document;
    setForm({
      doc_type: d.doc_type,
      doc_date: d.doc_date ?? "",
      doctor_name: d.doctor_name ?? "",
      doctor_crm: d.doctor_crm ?? "",
      requesting_doctor_name: d.requesting_doctor_name ?? "",
      requesting_doctor_crm: d.requesting_doctor_crm ?? "",
      reporting_doctor_name: d.reporting_doctor_name ?? "",
      reporting_doctor_crm: d.reporting_doctor_crm ?? "",
      summary: d.summary ?? "",
      cid: d.cid ?? "",
    });
    setItems(
      (data.items as ItemDraft[]).map((it) => ({
        id: it.id,
        kind: it.kind,
        name: it.name,
        value: it.value,
        unit: it.unit,
        reference_range: it.reference_range,
        dosage: it.dosage,
        route: it.route,
        notes: it.notes,
      })),
    );
  }, [data]);

  const low = new Set(data?.document.low_confidence_fields ?? []);
  const needsReview = search.review === 1 || data?.document.confidence === "review";

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      return upd({
        data: {
          id,
          patch: {
            doc_type: form.doc_type,
            doc_date: form.doc_date || null,
            doctor_name: form.doctor_name || null,
            doctor_crm: form.doctor_crm || null,
            requesting_doctor_name: form.requesting_doctor_name || null,
            requesting_doctor_crm: form.requesting_doctor_crm || null,
            reporting_doctor_name: form.reporting_doctor_name || null,
            reporting_doctor_crm: form.reporting_doctor_crm || null,
            summary: form.summary,
            cid: form.cid || null,
            confidence: "high",
            low_confidence_fields: [],
          },
          items: items.map((it) => ({
            ...it,
            name: it.name.trim(),
          })).filter((it) => it.name.length > 0),
        },
      });
    },
    onSuccess: () => {
      toast.success("Documento salvo");
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["document", id] });
      navigate({ to: "/timeline" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Documento excluído");
      qc.invalidateQueries({ queryKey: ["documents"] });
      navigate({ to: "/timeline" });
    },
  });

  const shareOne = useMutation({
    mutationFn: () => share({ data: { scope: "document", document_id: id, ttl_hours: 24 } }),
    onSuccess: (row) => setShareState({ open: true, token: row.token, expiresAt: row.expires_at }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data || !form) {
    return <AppShell><div className="h-64 rounded-xl bg-muted/50 animate-pulse" /></AppShell>;
  }

  const kind: "lab" | "med" =
    form.doc_type === "lab_exam" ? "lab" : form.doc_type === "prescription" ? "med" : items[0]?.kind ?? "lab";
  const meta = DOC_META[form.doc_type];
  const Icon = meta.icon;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/timeline" })}>
          <ArrowLeft className="size-4" /> Timeline
        </Button>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => shareOne.mutate()} disabled={shareOne.isPending}>
            <Share2 className="size-4" /><span className="hidden sm:inline ml-1">Compartilhar</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Excluir este documento?")) remove.mutate(); }}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {needsReview && (
        <div className="mb-4 rounded-xl bg-warning/25 border border-warning/40 p-3 text-sm flex gap-2 items-start">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Confira os campos destacados</p>
            <p className="text-muted-foreground">A IA teve dúvida em alguns pontos. Ajuste se necessário e salve.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className={`size-11 rounded-xl ${meta.tint} flex items-center justify-center`}>
          <Icon className={`size-5 ${meta.color}`} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{meta.label}</p>
          <h1 className="text-xl leading-tight">{form.summary || "Documento"}</h1>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {data.signedUrl ? (
            data.document.mime_type === "application/pdf" ? (
              <object data={data.signedUrl} type="application/pdf" className="w-full h-[70vh]">
                <a className="p-4 block text-primary" href={data.signedUrl} target="_blank" rel="noreferrer">
                  Abrir PDF original
                </a>
              </object>
            ) : (
              // eslint-disable-next-line jsx-a11y/img-redundant-alt
              <img src={data.signedUrl} alt="Documento original" className="w-full h-auto" />
            )
          ) : (
            <div className="p-8 text-muted-foreground">Arquivo indisponível</div>
          )}
        </div>

        <div className="space-y-4">
          <Field label="Resumo" reviewing={low.has("summary")}>
            <Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </Field>

          <Field label="Tipo de documento">
            <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v as typeof form.doc_type })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" reviewing={low.has("doc_date")}>
              <Input type="date" value={form.doc_date} onChange={(e) => setForm({ ...form, doc_date: e.target.value })} />
            </Field>
            <Field label="CID" reviewing={low.has("cid")}>
              <Input value={form.cid} onChange={(e) => setForm({ ...form, cid: e.target.value })} placeholder="Ex.: J06.9" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Médico" reviewing={low.has("doctor_name")}>
              <Input value={form.doctor_name} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })} />
            </Field>
            <Field label="CRM" reviewing={low.has("doctor_crm")}>
              <Input value={form.doctor_crm} onChange={(e) => setForm({ ...form, doctor_crm: e.target.value })} />
            </Field>
          </div>

          <ItemsEditor items={items} setItems={setItems} defaultKind={kind} low={low} />

          <div className="pt-2 flex gap-2">
            <Button className="flex-1 h-11" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>

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

function Field({ label, reviewing, children }: { label: string; reviewing?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className={reviewing ? "rounded-md ring-2 ring-warning/60 ring-offset-2 ring-offset-background" : ""}>
        {children}
      </div>
    </div>
  );
}

function ItemsEditor({
  items, setItems, defaultKind, low,
}: {
  items: ItemDraft[];
  setItems: (fn: (prev: ItemDraft[]) => ItemDraft[]) => void;
  defaultKind: "lab" | "med";
  low: Set<string>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {defaultKind === "med" ? "Medicamentos" : "Itens"}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setItems((p) => [...p, { kind: defaultKind, name: "" }])}
        >
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum item extraído. Use “Adicionar” se quiser incluir manualmente.</p>
        )}
        {items.map((it, idx) => {
          const isMed = it.kind === "med";
          const isReview = low.has(`items[${idx}]`) || low.has(`items[${idx}].value`) || low.has(`items[${idx}].dosage`);
          return (
            <div key={idx} className={`rounded-lg border border-border p-3 space-y-2 ${isReview ? "bg-warning/15" : "bg-card"}`}>
              <div className="flex gap-2">
                <Input
                  placeholder={isMed ? "Nome do medicamento" : "Nome do exame"}
                  value={it.name}
                  onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                />
                <Button
                  type="button" variant="ghost" size="icon"
                  onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                  aria-label="Remover item"
                >
                  <X className="size-4" />
                </Button>
              </div>
              {isMed ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Dosagem" value={it.dosage ?? ""} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, dosage: e.target.value } : x))} />
                  <Input placeholder="Via (oral, tópica…)" value={it.route ?? ""} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, route: e.target.value } : x))} />
                  <Textarea className="col-span-2 min-h-[60px]" placeholder="Instruções / posologia" value={it.notes ?? ""} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))} />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Valor" value={it.value ?? ""} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, value: e.target.value } : x))} />
                  <Input placeholder="Unidade" value={it.unit ?? ""} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))} />
                  <Input placeholder="Referência" value={it.reference_range ?? ""} onChange={(e) => setItems((p) => p.map((x, i) => i === idx ? { ...x, reference_range: e.target.value } : x))} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
