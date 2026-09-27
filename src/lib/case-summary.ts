import { z } from "zod";

// Validação tolerante: campo ausente ou com tipo errado vira vazio em vez de descartar o resumo todo.
// Itens que ficarem sem texto ou sem fonte são removidos depois, em verifyCaseContent.
const sources = z.preprocess(
  (v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.filter((x) => typeof x === "string") : []),
  z.array(z.string()),
);
const optText = z.preprocess((v) => (typeof v === "string" && v.trim() ? v : null), z.string().nullable());
const reqText = z.preprocess((v) => (typeof v === "string" ? v : ""), z.string());
const list = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []), z.array(item));
const sourced = z.object({ text: reqText, sources });
const maybeSourced = z.preprocess((v) => (v && typeof v === "object" ? v : null), sourced.nullable());
export const caseContentSchema = z.object({
  headline: reqText,
  headline_sources: sources,
  diagnosis: list(sourced.extend({ cid: optText, cid_is_suggested: z.preprocess((v) => v === true || v === "true", z.boolean()), date: optText })),
  staging: maybeSourced,
  timeline: list(z.object({ date: optText, event: reqText, sources })),
  current_treatment: maybeSourced,
  medications: list(z.object({ name: reqText, dosage: optText, sources })),
  recent_labs: list(z.object({ date: optText, highlights: reqText, sources })),
  care_team: list(z.object({ name: reqText, role: reqText, sources })),
  not_found: z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []), z.array(z.string())),
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
  const keep = <T extends { sources: string[] }>(items: T[], textOf: (it: T) => string) =>
    items
      .map((it) => ({ ...it, sources: clean(it.sources) }))
      .filter((it) => it.sources.length > 0 && textOf(it).trim().length > 0);
  const keepOne = <T extends { sources: string[]; text: string }>(item: T | null) => {
    if (!item) return null;
    const s = clean(item.sources);
    return s.length && item.text.trim() ? { ...item, sources: s } : null;
  };
  const cidWritten = (cid: string, srcs: string[]) => {
    const norm = cid.replace(/[\s.]/g, "").toUpperCase();
    return srcs.some((id) => {
      const d = byId.get(id);
      const hay = `${d?.cid ?? ""} ${d?.raw_text ?? ""}`.replace(/[\s.]/g, "").toUpperCase();
      return !!d && hay.includes(norm);
    });
  };

  const diagnosis = keep(content.diagnosis, (d) => d.text).map((d) =>
    d.cid && !cidWritten(d.cid, d.sources) ? { ...d, cid: null, cid_is_suggested: true } : d,
  );

  const result: CaseContent = {
    ...content,
    headline_sources: clean(content.headline_sources),
    diagnosis,
    staging: keepOne(content.staging),
    timeline: keep(content.timeline, (t) => t.event),
    current_treatment: keepOne(content.current_treatment),
    medications: keep(content.medications, (m) => m.name),
    recent_labs: keep(content.recent_labs, (l) => l.highlights),
    care_team: keep(content.care_team, (c) => c.name),
  };
  if (!result.headline.trim() && !result.diagnosis.length && !result.timeline.length) {
    throw new Error("A IA não conseguiu montar o resumo com base nos documentos. Tente novamente.");
  }
  return result;
}
