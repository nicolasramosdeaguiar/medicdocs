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

const listInput = z.object({ search: z.string().trim().max(200).optional() });
export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => listInput.parse(v ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("documents")
      .select("id, doc_type, doc_date, doctor_name, summary, confidence, created_at")
      .eq("user_id", userId)
      .order("doc_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    const s = data.search?.trim();
    if (s) {
      const term = `%${s.replace(/[%_]/g, "\\$&")}%`;
      q = q.or(
        `summary.ilike.${term},doctor_name.ilike.${term},raw_text.ilike.${term}`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
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
    doc_type: z.enum(["lab_exam", "prescription", "report", "referral", "authorization", "other"]).optional(),
    doc_date: z.string().nullable().optional(),
    doctor_name: z.string().nullable().optional(),
    doctor_crm: z.string().nullable().optional(),
    summary: z.string().max(240).optional(),
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

function extFromMime(mime: string, filename: string): string {
  const fromName = filename.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic") return "heic";
  return "jpg";
}
