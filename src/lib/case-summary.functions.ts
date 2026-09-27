import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { caseContentSchema, notesSchema, verifyCaseContent } from "./case-summary";

export const getCaseSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [summaryRes, notesRes, docsRes] = await Promise.all([
      supabase.from("case_summaries").select("id, content, source_document_ids, model, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("case_notes").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("documents").select("id, created_at, updated_at").eq("user_id", userId),
    ]);
    if (summaryRes.error || notesRes.error || docsRes.error) throw new Error("Não foi possível carregar o resumo do caso.");
    const row = summaryRes.data;
    const parsed = row ? caseContentSchema.safeParse(row.content) : null;
    const content = parsed?.success ? parsed.data : null;
    const stale = !!row && (docsRes.data ?? []).some((doc) => !row.source_document_ids.includes(doc.id) || doc.created_at > row.created_at || doc.updated_at > row.created_at);
    return {
      summary: row && content ? { ...row, content } : null,
      notes: notesRes.data,
      hasDocuments: (docsRes.data?.length ?? 0) > 0,
      stale: stale || (!!row && !!notesRes.data && notesRes.data.updated_at > row.created_at),
    };
  });

export const saveCaseNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => notesSchema.parse(value))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("case_notes").upsert({ user_id: context.userId, ...data });
    if (error) throw new Error("Não foi possível salvar as informações da família.");
    return { ok: true };
  });

export const generateCaseSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [docsRes, notesRes] = await Promise.all([
      supabase.from("documents").select("id, doc_type, doc_date, title, summary, cid, doctor_name, doctor_crm, requesting_doctor_name, requesting_doctor_crm, reporting_doctor_name, reporting_doctor_crm, raw_text").eq("user_id", userId).order("doc_date", { ascending: true }),
      supabase.from("case_notes").select("treatment_protocol, current_cycle, allergies, next_procedure, care_team_contact, other_notes").eq("user_id", userId).maybeSingle(),
    ]);
    if (docsRes.error || notesRes.error) throw new Error("Não foi possível ler os documentos.");
    const docs = docsRes.data ?? [];
    if (!docs.length) throw new Error("Adicione documentos antes de gerar o resumo.");
    const { data: items, error: itemsError } = await supabase.from("document_items").select("document_id, kind, name, value, unit, reference_range, dosage, route, notes").in("document_id", docs.map((d) => d.id)).order("order_index");
    if (itemsError) throw new Error("Não foi possível ler os itens dos documentos.");
    const notes = notesRes.data;
    const { generateClinicalContent, CASE_MODEL } = await import("./case-summary-ai.server");
    // Limita o texto bruto de cada documento para não estourar tempo/limite da IA
    const perDoc = Math.max(4000, Math.floor(160_000 / docs.length));
    const content = verifyCaseContent(await generateClinicalContent({
      documents: docs.map((doc) => ({
        ...doc,
        raw_text: doc.raw_text ? doc.raw_text.slice(0, perDoc) : null,
        items: (items ?? []).filter((item) => item.document_id === doc.id),
      })),
      family_notes: notes ? { source: "family", ...notes } : null,
    }), docs, !!notes && Object.values(notes).some(Boolean));
    const { error } = await supabase.from("case_summaries").insert({
      user_id: userId, content, source_document_ids: docs.map((d) => d.id), model: CASE_MODEL,
    });
    if (error) throw new Error("Não foi possível salvar o resumo.");
    return { ok: true };
  });
