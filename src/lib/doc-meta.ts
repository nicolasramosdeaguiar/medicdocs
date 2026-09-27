import type { LucideIcon } from "lucide-react";
import { FlaskConical, Pill, FileText, Send, ShieldCheck, FileQuestion } from "lucide-react";

export type DocType = "lab_exam" | "prescription" | "report" | "referral" | "authorization" | "other";

export const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "lab_exam", label: "Exame laboratorial" },
  { value: "prescription", label: "Receita" },
  { value: "report", label: "Laudo / Diagnóstico" },
  { value: "referral", label: "Encaminhamento" },
  { value: "authorization", label: "Autorização" },
  { value: "other", label: "Outro" },
];

export const DOC_META: Record<DocType, { label: string; icon: LucideIcon; color: string; tint: string }> = {
  lab_exam:      { label: "Exame",         icon: FlaskConical, color: "text-doc-lab",           tint: "bg-doc-lab/12" },
  prescription:  { label: "Receita",       icon: Pill,         color: "text-doc-prescription",  tint: "bg-doc-prescription/12" },
  report:        { label: "Laudo",         icon: FileText,     color: "text-doc-report",        tint: "bg-doc-report/12" },
  referral:      { label: "Encaminhamento",icon: Send,         color: "text-doc-referral",      tint: "bg-doc-referral/12" },
  authorization: { label: "Autorização",   icon: ShieldCheck,  color: "text-doc-authorization", tint: "bg-doc-authorization/12" },
  other:         { label: "Documento",     icon: FileQuestion, color: "text-doc-other",         tint: "bg-doc-other/12" },
};

/**
 * Título curto do documento. Se não houver título, usa o resumo cortado
 * no primeiro ":" ou "," (máx. 50 caracteres).
 */
export function docTitle(title: string | null | undefined, summary: string | null | undefined): string {
  const t = title?.trim();
  if (t) return t;
  const s = summary?.trim();
  if (!s) return "Documento";
  const cut = s.split(/[:,]/)[0].trim() || s;
  return cut.length > 50 ? cut.slice(0, 50).trimEnd() + "…" : cut;
}

const NAME_LOWER = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Exibe nomes em caixa alta com capitalização normal ("Dra. Katia Zanotelli"). */
export function formatPersonName(name: string | null | undefined): string {
  const raw = name?.trim();
  if (!raw) return "";
  if (raw !== raw.toUpperCase()) return raw; // já tem capitalização própria
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) =>
      i > 0 && NAME_LOWER.has(word.replace(/\./g, ""))
        ? word
        : word.replace(/^[\p{L}]/u, (c) => c.toUpperCase()),
    )
    .join(" ");
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Sem data";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
