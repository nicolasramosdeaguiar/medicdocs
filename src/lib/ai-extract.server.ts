/**
 * Chama o Lovable AI Gateway (Gemini multimodal) para OCR + extração
 * estruturada de um documento de saúde.
 *
 * Recebe o arquivo já em base64 e o mime type. Devolve um objeto com os
 * campos esperados pela Timeline / tela de confirmação.
 */

export type ExtractedItem = {
  kind: "lab" | "med";
  name: string;
  value?: string | null;
  unit?: string | null;
  reference_range?: string | null;
  dosage?: string | null;
  route?: string | null;
  notes?: string | null;
};

export type ExtractionResult = {
  doc_type: "lab_exam" | "prescription" | "report" | "referral" | "authorization" | "other";
  doc_date: string | null;
  doctor_name: string | null;
  doctor_crm: string | null;
  requesting_doctor_name: string | null;
  requesting_doctor_crm: string | null;
  reporting_doctor_name: string | null;
  reporting_doctor_crm: string | null;
  title: string | null;
  summary: string;
  cid: string | null;
  raw_text: string;
  confidence: "high" | "review";
  low_confidence_fields: string[];
  items: ExtractedItem[];
};


const SYSTEM_PROMPT = `Você é um assistente que extrai informações estruturadas de documentos médicos brasileiros (exames laboratoriais, receitas, laudos, encaminhamentos e autorizações). Responda SEMPRE em JSON válido, seguindo o schema pedido. Escreva em português. Se um campo estiver ilegível, incerto ou ausente, retorne null e adicione o caminho do campo em "low_confidence_fields". Se pelo menos um campo importante estiver incerto, defina "confidence" como "review"; caso contrário, "high".`;

const USER_INSTRUCTIONS = `Analise o documento anexado e devolva um JSON com este formato exato:
{
  "doc_type": "lab_exam" | "prescription" | "report" | "referral" | "authorization" | "other",
  "doc_date": "YYYY-MM-DD" | null,
  "doctor_name": string | null,           // médico principal / assinante do documento
  "doctor_crm": string | null,
  "requesting_doctor_name": string | null, // médico solicitante (exames, biópsias, laudos). null se não houver.
  "requesting_doctor_crm": string | null,
  "reporting_doctor_name": string | null,  // médico que laudou / patologista responsável. null se não houver.
  "reporting_doctor_crm": string | null,
  "title": string,
  "summary": string,
  "cid": string | null,
  "raw_text": string,
  "confidence": "high" | "review",
  "low_confidence_fields": string[],
  "items": [
    { "kind": "lab", "name": string, "value": string|null, "unit": string|null, "reference_range": string|null }
    // ou para receitas:
    // { "kind": "med", "name": string, "dosage": string|null, "route": string|null, "notes": string|null }
  ]
}
Regras:
- Para exames laboratoriais, biópsias e laudos: procure explicitamente o "médico solicitante" (quem pediu) e o "médico responsável pelo laudo" / patologista (quem assinou o resultado). Use null quando o campo não aparecer no documento.
- Para receitas e encaminhamentos, use apenas doctor_name/doctor_crm (médico assinante) e deixe os campos requesting_/reporting_ como null.
- Sempre inclua "items" (pode ser array vazio).
- Não invente valores. Prefira null e marque em low_confidence_fields quando incerto.
- Datas em ISO (YYYY-MM-DD). Se só houver mês/ano, use o primeiro dia do mês.
- "title": nome do documento, exame ou procedimento, no máximo 50 caracteres. NÃO inclua nome do paciente, nome do médico, achados nem conclusões. Exemplos válidos: "Videoendoscopia digestiva alta", "Hemograma completo", "Exame anatomopatológico", "Pedido de endoscopia e ecoendoscopia", "Receita médica".
- "summary": resumo do conteúdo — principais achados e conclusões, em 2 a 4 frases curtas, em português simples e acolhedor. Não repita o título.
Responda apenas com o JSON, sem texto adicional.`;


export async function extractFromDocument(
  fileBase64: string,
  mimeType: string,
): Promise<ExtractionResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente no servidor.");

  const dataUrl = `data:${mimeType};base64,${fileBase64}`;
  const contentBlock =
    mimeType === "application/pdf"
      ? { type: "file", file: { filename: "documento.pdf", file_data: dataUrl } }
      : { type: "image_url", image_url: { url: dataUrl } };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: USER_INSTRUCTIONS },
            contentBlock,
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("A IA está sobrecarregada. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados neste workspace.");
    throw new Error(`Falha na extração (${res.status}). ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: Partial<ExtractionResult>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Tenta recuperar JSON embutido em markdown
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : {};
  }

  return normalize(parsed);
}

function normalize(p: Partial<ExtractionResult>): ExtractionResult {
  const doc_type = (["lab_exam", "prescription", "report", "referral", "authorization", "other"] as const).includes(
    p.doc_type as never,
  )
    ? (p.doc_type as ExtractionResult["doc_type"])
    : "other";
  const confidence = p.confidence === "review" ? "review" : "high";
  const items = Array.isArray(p.items)
    ? p.items
        .filter((i) => i && typeof i.name === "string" && i.name.trim())
        .map((i) => ({
          kind: i.kind === "med" ? ("med" as const) : ("lab" as const),
          name: String(i.name).slice(0, 300),
          value: nullish(i.value),
          unit: nullish(i.unit),
          reference_range: nullish(i.reference_range),
          dosage: nullish(i.dosage),
          route: nullish(i.route),
          notes: nullish(i.notes),
        }))
    : [];
  const low = Array.isArray(p.low_confidence_fields)
    ? p.low_confidence_fields.filter((x): x is string => typeof x === "string").slice(0, 32)
    : [];
  return {
    doc_type,
    doc_date: normalizeDate(p.doc_date),
    doctor_name: nullish(p.doctor_name),
    doctor_crm: nullish(p.doctor_crm),
    requesting_doctor_name: nullish(p.requesting_doctor_name),
    requesting_doctor_crm: nullish(p.requesting_doctor_crm),
    reporting_doctor_name: nullish(p.reporting_doctor_name),
    reporting_doctor_crm: nullish(p.reporting_doctor_crm),
    title: normalizeTitle(p.title),
    summary: (p.summary ?? "Documento").toString().slice(0, 1200),
    cid: nullish(p.cid),
    raw_text: (p.raw_text ?? "").toString().slice(0, 20000),
    confidence,
    low_confidence_fields: low,
    items,
  };
}

function nullish(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, 500) : null;
}

function normalizeDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function normalizeTitle(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > 60 ? s.slice(0, 60).trimEnd() : s;
}

/** Gera apenas o título curto a partir do texto já extraído (backfill). */
export async function titleFromText(rawText: string): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente no servidor.");
  const text = rawText.slice(0, 8000);
  if (!text.trim()) return null;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Você nomeia documentos médicos brasileiros. Responda apenas JSON: {"title": string}. O título é o nome do documento, exame ou procedimento, no máximo 50 caracteres, em português, sem nome do paciente, sem nome do médico, sem achados ou conclusões. Exemplos: "Videoendoscopia digestiva alta", "Hemograma completo", "Exame anatomopatológico", "Pedido de endoscopia e ecoendoscopia", "Receita médica".',
        },
        { role: "user", content: `Texto do documento:\n\n${text}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Falha ao gerar título (${res.status}).`);
  const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  try {
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { title?: unknown };
    return normalizeTitle(parsed.title);
  } catch {
    return null;
  }
}
