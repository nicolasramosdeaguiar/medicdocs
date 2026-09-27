import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { caseContentSchema, type CaseContent } from "./case-summary";

export const CASE_MODEL = "google/gemini-2.5-pro";
const PROMPT = `Você organiza documentos médicos em um resumo de caso para um médico que não conhece o paciente. REGRAS OBRIGATÓRIAS:
- Use APENAS informações presentes nos documentos ou nas notas da família. Nunca deduza diagnóstico, estadiamento, prognóstico ou protocolo.
- Toda afirmação, inclusive headline, deve citar os ids dos documentos de origem em sources. Informações das notas da família usam exclusivamente o identificador "family".
- Nome de protocolo de quimioterapia só se estiver escrito. Caso contrário, liste medicamentos e doses como aparecem.
- Não faça recomendações de conduta nem opiniões clínicas.
- Liste explicitamente as informações importantes que NÃO constam nos documentos.
- Linguagem técnica médica, objetiva, em português.
- Quando um diagnóstico constar no documento mas não o código CID, defina cid como null e cid_is_suggested como true. Nunca sugira um número CID não informado.
- Se não houver diagnóstico confirmado, a headline deve dizer que não foi identificado nos documentos; cite o documento que fundamenta essa observação. Não trate pedidos de exames como resultados.
Responda APENAS um objeto JSON com headline, headline_sources, diagnosis, staging, timeline, current_treatment, medications, recent_labs, care_team, not_found. Use arrays vazias e null quando não houver evidência. Cada entrada factual tem sources. Datas ISO quando conhecidas.`;

export async function generateClinicalContent(input: unknown): Promise<CaseContent> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("Serviço de IA não configurado.");
  let runId: string | undefined;
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (url, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const response = await fetch(url, { ...init, headers });
      runId ??= response.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
        const safeMessage = body.error?.message ?? body.message ?? `Falha da IA (${response.status}).`;
        throw new Error(safeMessage);
      }
      return response;
    },
  });
  const result = streamText({
    model: provider(CASE_MODEL),
    maxRetries: 0,
    system: PROMPT,
    prompt: `Documentos e informações da família em ordem cronológica:\n${JSON.stringify(input)}\n\nRetorne JSON válido.`,
  });
  const text = (await result.text).trim();
  if (!text) throw new Error("A IA não devolveu um resumo. Nenhuma informação foi salva.");
  let raw: unknown;
  try { raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); }
  catch { throw new Error("A IA devolveu um resumo incompleto. Nenhuma informação foi salva."); }
  const parsed = caseContentSchema.safeParse(raw);
  if (!parsed.success) throw new Error("A IA devolveu um resumo incompleto. Nenhuma informação foi salva.");
  return parsed.data;
}