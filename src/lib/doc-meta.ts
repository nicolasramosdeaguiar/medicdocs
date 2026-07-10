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

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Sem data";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
