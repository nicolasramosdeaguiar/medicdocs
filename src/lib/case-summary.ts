import { z } from "zod";

// Validação tolerante: campos ausentes viram null/lista vazia em vez de descartar o resumo todo
const sources = z.array(z.string()).optional().default([]);
const optText = z.string().nullable().optional().default(null);
const sourced = z.object({ text: z.string(), sources });
export const caseContentSchema = z.object({
  headline: z.string().optional().default(""),
  headline_sources: sources,
  diagnosis: z.array(sourced.extend({ cid: optText, cid_is_suggested: z.boolean().optional().default(false), date: optText })).optional().default([]),
  staging: sourced.nullable().optional().default(null),
  timeline: z.array(z.object({ date: optText, event: z.string(), sources })).optional().default([]),
  current_treatment: sourced.nullable().optional().default(null),
  medications: z.array(z.object({ name: z.string(), dosage: optText, sources })).optional().default([]),
  recent_labs: z.array(z.object({ date: optText, highlights: z.string(), sources })).optional().default([]),
  care_team: z.array(z.object({ name: z.string(), role: z.string().optional().default(""), sources })).optional().default([]),
  not_found: z.array(z.string()).optional().default([]),
});
export type CaseContent = z.infer<typeof caseContentSchema>;

export const notesSchema = z.object({
  treatment_protocol: z.string().max(3000).nullable(),
  current_cycle: z.string().max(3000).nullable(),
  allergies: z.string().max(3000).nullable(),
  next_procedure: z.string().max(3000).nullable(),
  care_team_contact: z.string().max(3000).nullable(),
  other_notes: z.string().max(5000).nullable(),
});
export type CaseNotes = z.infer<typeof notesSchema>;

type SourceDoc = { id: string; cid: string | null; raw_text: string | null };

/**
 * Limpa o resumo em vez de rejeitar tudo:
 * - remove referências a documentos que não existem
 * - descarta itens que ficaram sem nenhuma fonte válida (regra: nada sem fonte)
 * - CID só permanece se estiver escrito em algum documento de origem
 */
export function verifyCaseContent(content: CaseContent, docs: SourceDoc[], hasNotes: boolean): CaseContent {
  const byId = new Map(docs.map((d) => [d.id, d]));
  const clean = (list: string[]) =>
    [...new Set(list)].filter((s) => (s === "family" ? hasNotes : byId.has(s)));
  const keep = <T extends { sources: string[] }>(items: T[]) =>
    items.map((it) => ({ ...it, sources: clean(it.sources) })).filter((it) => it.sources.length > 0);
  const keepOne = <T extends { sources: string[] }>(item: T | null) => {
    if (!item) return null;
    const s = clean(item.sources);
    return s.length ? { ...item, sources: s } : null;
  };
  const cidWritten = (cid: string, srcs: string[]) => {
    const norm = cid.replace(/[\s.]/g, "").toUpperCase();
    return srcs.some((id) => {
      const d = byId.get(id);
      const hay = `${d?.cid ?? ""} ${d?.raw_text ?? ""}`.replace(/[\s.]/g, "").toUpperCase();
      return !!d && hay.includes(norm);
    });
  };

  const diagnosis = keep(content.diagnosis).map((d) =>
    d.cid && !cidWritten(d.cid, d.sources) ? { ...d, cid: null, cid_is_suggested: true } : d,
  );

  const result: CaseContent = {
    ...content,
    headline_sources: clean(content.headline_sources),
    diagnosis,
    staging: keepOne(content.staging),
    timeline: keep(content.timeline),
    current_treatment: keepOne(content.current_treatment),
    medications: keep(content.medications),
    recent_labs: keep(content.recent_labs),
    care_team: keep(content.care_team),
  };
  if (!result.headline.trim() && !result.diagnosis.length && !result.timeline.length) {
    throw new Error("A IA não conseguiu montar o resumo com base nos documentos. Tente novamente.");
  }
  return result;
}
