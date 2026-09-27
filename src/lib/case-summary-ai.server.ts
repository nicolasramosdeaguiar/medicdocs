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

// Chama a IA do mesmo jeito que a extração de documentos (que já funciona):
// resposta obrigatoriamente em JSON e com espaço de sobra para não cortar no meio.
export async function generateClinicalContent(input: unknown): Promise<CaseContent> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Serviço de IA não configurado.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: CASE_MODEL,
      response_format: { type: "json_object" },
      max_tokens: 24000,
      messages: [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: `Documentos e informações da família em ordem cronológica:\n${JSON.stringify(input)}\n\nRetorne apenas o JSON.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("A IA está sobrecarregada. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados neste workspace.");
    throw new Error(`Falha da IA (${res.status}). ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  };
  const choice = json.choices?.[0];
  const text = (choice?.message?.content ?? "").trim();
  if (!text) throw new Error("A IA não devolveu um resumo. Nada foi salvo.");
  if (choice?.finish_reason === "length") {
    throw new Error("O resumo ficou longo demais e foi cortado pela IA. Nada foi salvo.");
  }

  // Aceita JSON mesmo com texto ou ``` em volta: pega do primeiro { ao último }
  let raw: unknown;
  try {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    raw = JSON.parse(first >= 0 && last > first ? text.slice(first, last + 1) : text);
  } catch {
    throw new Error(`A IA devolveu um resumo em formato inválido (JSON ilegível, ${text.length} caracteres). Nada foi salvo.`);
  }

  const parsed = caseContentSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`A IA devolveu um resumo fora do formato (campo "${issue?.path.join(".")}": ${issue?.message}). Nada foi salvo.`);
  }
  return parsed.data;
}
