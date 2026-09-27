import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uploadInput = z.object({
  file_base64: z.string().min(10).max(15_000_000), // ~11MB binário
  mime_type: z.string().max(120),
  filename: z.string().max(240),
});

export const uploadAndExtract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => uploadInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { extractFromDocument } = await import("@/lib/ai-extract.server");

    // 1) extração
    const extracted = await extractFromDocument(data.file_base64, data.mime_type);

    // 2) upload do arquivo original
    const ext = extFromMime(data.mime_type, data.filename);
    const filePath = `${userId}/${crypto.randomUUID()}.${ext}`;
    const bytes = Uint8Array.from(atob(data.file_base64), (c) => c.charCodeAt(0));
    const up = await supabase.storage.from("medical-docs").upload(filePath, bytes, {
      contentType: data.mime_type,
      upsert: false,
    });
    if (up.error) throw new Error(`Falha ao salvar arquivo: ${up.error.message}`);

    // 3) grava documento
    const { data: doc, error } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        doc_type: extracted.doc_type,
        doc_date: extracted.doc_date,
        doctor_name: extracted.doctor_name,
        doctor_crm: extracted.doctor_crm,
        requesting_doctor_name: extracted.requesting_doctor_name,
        requesting_doctor_crm: extracted.requesting_doctor_crm,
        reporting_doctor_name: extracted.reporting_doctor_name,
        reporting_doctor_crm: extracted.reporting_doctor_crm,
        title: extracted.title,
        summary: extracted.summary,
        cid: extracted.cid,
        raw_text: extracted.raw_text,
        confidence: extracted.confidence,
        low_confidence_fields: extracted.low_confidence_fields,
        file_path: filePath,
        mime_type: data.mime_type,
      })
      .select("id")
      .single();
    if (error || !doc) throw new Error(`Falha ao gravar documento: ${error?.message}`);

    // 4) itens
    if (extracted.items.length > 0) {
      const rows = extracted.items.map((it, idx) => ({
        document_id: doc.id,
        kind: it.kind,
        name: it.name,
        value: it.value,
        unit: it.unit,
        reference_range: it.reference_range,
        dosage: it.dosage,
        route: it.route,
        notes: it.notes,
        order_index: idx,
      }));
      const ins = await supabase.from("document_items").insert(rows);
      if (ins.error) throw new Error(`Falha ao gravar itens: ${ins.error.message}`);
    }

    return { id: doc.id as string };
  });

const listInput = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.enum(["exames", "receitas", "pedidos", "outros"]).optional(),
});
type Category = "exames" | "receitas" | "pedidos" | "outros";

// Aplica o filtro de categoria em qualquer consulta de documentos
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCategory<T extends { in: any; eq: any }>(q: T, category?: Category): T {
  if (category === "exames") return q.in("doc_type", ["lab_exam", "report"]);
  if (category === "receitas") return q.eq("doc_type", "prescription");
  if (category === "pedidos") return q.in("doc_type", ["exam_request", "referral", "authorization"]);
  if (category === "outros") return q.eq("doc_type", "other");
  return q;
}

// Remove acentos, deixa minúsculo e troca pontuação por espaço.
// "Anátomo-patológico" -> "anatomo patologico"
function normalizeForSearch(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => listInput.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tokens = normalizeForSearch(data.search ?? "").split(" ").filter(Boolean);

    // Sem busca: lista normal
    if (tokens.length === 0) {
      const q = applyCategory(
        supabase
          .from("documents")
          .select("id, doc_type, doc_date, doctor_name, title, summary, confidence, created_at")
          .eq("user_id", userId)
          .order("doc_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(200),
        data.category,
      );
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      return rows ?? [];
    }

    // Com busca: traz os documentos da categoria e filtra aqui,
    // ignorando acentos e maiúsculas, em todos os campos relevantes.
    const q = applyCategory(
      supabase
        .from("documents")
        .select(
          "id, doc_type, doc_date, doctor_name, title, summary, confidence, created_at, requesting_doctor_name, reporting_doctor_name, cid, raw_text",
        )
        .eq("user_id", userId)
        .order("doc_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500),
      data.category,
    );
    const { data: docs, error } = await q;
    if (error) throw new Error(error.message);
    if (!docs || docs.length === 0) return [];

    // Nomes de exames e remédios (a RLS já limita aos documentos do usuário)
    const { data: items } = await supabase.from("document_items").select("document_id, name").limit(5000);
    const itemNames = new Map<string, string[]>();
    for (const it of items ?? []) {
      const list = itemNames.get(it.document_id) ?? [];
      list.push(it.name);
      itemNames.set(it.document_id, list);
    }

    const matches = docs.filter((d) => {
      const haystack = normalizeForSearch(
        [
          d.title,
          d.summary,
          d.doctor_name,
          d.requesting_doctor_name,
          d.reporting_doctor_name,
          d.cid,
          (itemNames.get(d.id) ?? []).join(" "),
          d.raw_text,
        ]
          .filter(Boolean)
          .join(" "),
      );
      // Todas as palavras digitadas precisam aparecer (em qualquer ordem)
      return tokens.every((t) => haystack.includes(t));
    });

    return matches.slice(0, 200).map((d) => ({
      id: d.id,
      doc_type: d.doc_type,
      doc_date: d.doc_date,
      doctor_name: d.doctor_name,
      title: d.title,
      summary: d.summary,
      confidence: d.confidence,
      created_at: d.created_at,
    }));
  });

export const getDocumentCategoryCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const types = ["lab_exam", "report", "prescription", "exam_request", "referral", "authorization", "other"] as const;
    const results = await Promise.all(types.map((type) =>
      context.supabase.from("documents").select("id", { count: "exact", head: true })
        .eq("user_id", context.userId).eq("doc_type", type),
    ));
    const error = results.find((result) => result.error)?.error;
    if (error) throw new Error(error.message);
    const counts = Object.fromEntries(types.map((type, index) => [type, results[index]?.count ?? 0]));
    return {
      todos: Object.values(counts).reduce((sum, count) => sum + count, 0),
      exames: counts.lab_exam + counts.report,
      receitas: counts.prescription,
      pedidos: counts.exam_request + counts.referral + counts.authorization,
      outros: counts.other,
    };
  });

const idInput = z.object({ id: z.string().uuid() });

export const getDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error || !doc) throw new Error("Documento não encontrado");

    const { data: items } = await supabase
      .from("document_items")
      .select("*")
      .eq("document_id", doc.id)
      .order("order_index");

    const signed = await supabase.storage
      .from("medical-docs")
      .createSignedUrl(doc.file_path, 60 * 60);

    return { document: doc, items: items ?? [], signedUrl: signed.data?.signedUrl ?? null };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    doc_type: z.enum(["lab_exam", "prescription", "report", "exam_request", "referral", "authorization", "other"]).optional(),
    doc_date: z.string().nullable().optional(),
    doctor_name: z.string().nullable().optional(),
    doctor_crm: z.string().nullable().optional(),
    requesting_doctor_name: z.string().nullable().optional(),
    requesting_doctor_crm: z.string().nullable().optional(),
    reporting_doctor_name: z.string().nullable().optional(),
    reporting_doctor_crm: z.string().nullable().optional(),
    title: z.string().max(60).nullable().optional(),
    summary: z.string().max(2000).optional(),
    cid: z.string().nullable().optional(),
    confidence: z.enum(["high", "review"]).optional(),
    low_confidence_fields: z.array(z.string()).optional(),
  }),
  items: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        kind: z.enum(["lab", "med"]),
        name: z.string().min(1).max(300),
        value: z.string().nullable().optional(),
        unit: z.string().nullable().optional(),
        reference_range: z.string().nullable().optional(),
        dosage: z.string().nullable().optional(),
        route: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

export const updateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => updateInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const upd = await supabase
      .from("documents")
      .update(data.patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (upd.error) throw new Error(upd.error.message);

    if (data.items) {
      // Replace-all strategy: simpler and safe for MVP
      await supabase.from("document_items").delete().eq("document_id", data.id);
      if (data.items.length) {
        const rows = data.items.map((it, idx) => ({
          document_id: data.id,
          kind: it.kind,
          name: it.name,
          value: it.value ?? null,
          unit: it.unit ?? null,
          reference_range: it.reference_range ?? null,
          dosage: it.dosage ?? null,
          route: it.route ?? null,
          notes: it.notes ?? null,
          order_index: idx,
        }));
        const ins = await supabase.from("document_items").insert(rows);
        if (ins.error) throw new Error(ins.error.message);
      }
    }
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => idInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc } = await supabase
      .from("documents")
      .select("file_path")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (doc?.file_path) {
      await supabase.storage.from("medical-docs").remove([doc.file_path]);
    }
    const del = await supabase.from("documents").delete().eq("id", data.id).eq("user_id", userId);
    if (del.error) throw new Error(del.error.message);
    return { ok: true };
  });

/**
 * Gera o título dos documentos antigos que ainda não têm um, a partir do
 * texto já extraído. Roda uma única vez por documento.
 */
export const backfillTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { titleFromText, normalizeTitle } = await import("@/lib/ai-extract.server");

    const { data: rows, error } = await supabase
      .from("documents")
      .select("id, raw_text, summary")
      .eq("user_id", userId)
      .is("title", null)
      .limit(200);
    if (error) throw new Error(error.message);

    let updated = 0;
    for (const row of rows ?? []) {
      let title: string | null = null;
      try {
        title = row.raw_text ? await titleFromText(row.raw_text) : null;
      } catch {
        title = null;
      }
      if (!title && row.summary) {
        const cut = row.summary.split(/[:,]/)[0]?.trim();
        title = normalizeTitle(cut ? cut.slice(0, 50) : null);
      }
      if (!title) continue;
      const upd = await supabase.from("documents").update({ title }).eq("id", row.id).eq("user_id", userId);
      if (!upd.error) updated += 1;
    }
    return { updated, pending: (rows?.length ?? 0) - updated };
  });

function extFromMime(mime: string, filename: string): string {
  const fromName = filename.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  return "jpg";
}
