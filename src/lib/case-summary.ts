import { z } from "zod";

const sourced = z.object({ text: z.string(), sources: z.array(z.string()) });
export const caseContentSchema = z.object({
  headline: z.string(),
  headline_sources: z.array(z.string()),
  diagnosis: z.array(sourced.extend({ cid: z.string().nullable(), cid_is_suggested: z.boolean(), date: z.string().nullable() })),
  staging: sourced.nullable(),
  timeline: z.array(z.object({ date: z.string().nullable(), event: z.string(), sources: z.array(z.string()) })),
  current_treatment: sourced.nullable(),
  medications: z.array(z.object({ name: z.string(), dosage: z.string().nullable(), sources: z.array(z.string()) })),
  recent_labs: z.array(z.object({ date: z.string().nullable(), highlights: z.string(), sources: z.array(z.string()) })),
  care_team: z.array(z.object({ name: z.string(), role: z.string(), sources: z.array(z.string()) })),
  not_found: z.array(z.string()),
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

export function verifyCaseContent(content: CaseContent, documentIds: string[], hasNotes: boolean): CaseContent {
  const allowed = new Set(documentIds);
  const check = (sources: string[]) => {
    if (!sources.length || sources.some((source) => source !== "family" && !allowed.has(source)) || (sources.includes("family") && !hasNotes)) {
      throw new Error("O resumo contém referências inválidas. Nenhuma informação foi salva.");
    }
  };
  check(content.headline_sources);
  for (const entry of content.diagnosis) check(entry.sources);
  if (content.staging) check(content.staging.sources);
  for (const entry of content.timeline) check(entry.sources);
  if (content.current_treatment) check(content.current_treatment.sources);
  for (const entry of content.medications) check(entry.sources);
  for (const entry of content.recent_labs) check(entry.sources);
  for (const entry of content.care_team) check(entry.sources);
  return content;
}