import { Link } from "@tanstack/react-router";
import { formatDate } from "@/lib/doc-meta";
import type { CaseContent } from "@/lib/case-summary";

export function CaseSummaryView({ content, createdAt, publicIds, category }: {
  content: CaseContent; createdAt: string; publicIds?: string[]; category?: "exames" | "receitas" | "pedidos" | "outros";
}) {
  const references = (sources: string[]) => <span className="inline-flex flex-wrap gap-1 ml-2 align-middle">
    {sources.map((source) => source === "family" ? <span key={source} className="text-xs text-primary border border-primary/30 px-2 py-0.5 rounded-sm">Informado pelo paciente/família</span> : publicIds ? publicIds.includes(source) ? <a key={source} className="text-xs underline text-primary" href={`#document-${source}`}>Documento de origem</a> : <span key={source} className="text-xs text-muted-foreground">Documento de origem não compartilhado</span> : <Link key={source} to="/documents/$id" params={{ id: source }} search={category ? { categoria: category } : {}} className="text-xs underline text-primary">Documento de origem</Link>)}
  </span>;
  const section = (name: string, children: React.ReactNode) => <section className="border-t border-border pt-5 space-y-3"><h2 className="text-xl">{name}</h2>{children}</section>;
  return <div className="space-y-7">
    <div className="sticky top-0 z-20 border border-warning/40 bg-background p-3 text-sm">Resumo gerado automaticamente a partir dos documentos enviados. Confira sempre os documentos originais.</div>
    <div><p className="text-xs text-muted-foreground">Gerado em {formatDate(createdAt)}</p><p className="mt-2 text-lg font-medium">{content.headline}{references(content.headline_sources)}</p></div>
    {section("Diagnósticos", content.diagnosis.length ? <ul className="space-y-3">{content.diagnosis.map((item, i) => <li key={i}><strong>{item.text}</strong>{item.cid && <span> · CID {item.cid}</span>}{item.cid_is_suggested && <span className="ml-2 text-xs text-warning-foreground">CID sugerido</span>}{item.date && <span className="text-muted-foreground"> · {formatDate(item.date)}</span>}{references(item.sources)}</li>)}</ul> : <p className="text-muted-foreground">Não identificado nos documentos.</p>)}
    {content.staging && section("Estadiamento", <p>{content.staging.text}{references(content.staging.sources)}</p>)}
    {section("Linha do tempo", <ul className="space-y-3">{content.timeline.map((item, i) => <li key={i}><span className="text-muted-foreground">{item.date ? formatDate(item.date) : "Data não informada"} · </span>{item.event}{references(item.sources)}</li>)}</ul>)}
    {section("Tratamento atual", content.current_treatment ? <p>{content.current_treatment.text}{references(content.current_treatment.sources)}</p> : <p className="text-muted-foreground">Não informado nos documentos.</p>)}
    {section("Medicamentos", <ul className="space-y-2">{content.medications.map((item, i) => <li key={i}>{item.name}{item.dosage && ` · ${item.dosage}`}{references(item.sources)}</li>)}</ul>)}
    {section("Exames recentes", <ul className="space-y-2">{content.recent_labs.map((item, i) => <li key={i}>{item.date && `${formatDate(item.date)} · `}{item.highlights}{references(item.sources)}</li>)}</ul>)}
    {section("Equipe de cuidado", <ul className="space-y-2">{content.care_team.map((item, i) => <li key={i}>{item.name} · {item.role}{references(item.sources)}</li>)}</ul>)}
    {section("Não encontrado nos documentos", <ul className="list-disc pl-5 space-y-1">{content.not_found.map((item, i) => <li key={i}>{item}</li>)}</ul>)}
  </div>;
}