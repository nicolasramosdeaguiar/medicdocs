import { createFileRoute } from "@tanstack/react-router";
import { viewShare } from "@/lib/shares.functions";
import { DOC_META, formatDate } from "@/lib/doc-meta";
import { HeartPulse, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/s/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Documentos compartilhados — Meddocs" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ params }) => viewShare({ data: { token: params.token } }),
  component: SharePage,
});

function SharePage() {
  const data = Route.useLoaderData();

  if (!data.valid) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="size-10 text-warning-foreground mb-3" />
        <h1 className="text-xl">
          {data.reason === "revoked" ? "Link revogado" : data.reason === "expired" ? "Link expirado" : "Link inválido"}
        </h1>
        <p className="mt-2 text-muted-foreground max-w-sm">
          Peça ao paciente para gerar um novo link no Meddocs.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-2">
          <HeartPulse className="size-5 text-primary" />
          <span className="font-serif text-lg text-primary">Meddocs</span>
          <span className="ml-auto text-xs text-muted-foreground">visualização somente leitura</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl">
            {data.patient_name ? `Documentos de ${data.patient_name}` : "Documentos do paciente"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.scope === "all" ? "Compartilhamento completo" : "Documento único"}
            {data.expires_at ? ` · acesso válido até ${formatDate(data.expires_at)}` : ""}
          </p>
        </div>

        {data.documents.length === 0 ? (
          <p className="text-muted-foreground">Nenhum documento disponível.</p>
        ) : (
          <ul className="space-y-6">
            {data.documents.map((doc: any) => {
              const meta = DOC_META[doc.doc_type as keyof typeof DOC_META];
              const Icon = meta.icon;
              return (
                <li key={doc.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start gap-3">
                    <div className={`size-11 rounded-xl ${meta.tint} flex items-center justify-center`}>
                      <Icon className={`size-5 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{meta.label}</p>
                      <h2 className="text-lg leading-tight">{doc.summary || "Documento"}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formatDate(doc.doc_date ?? doc.created_at)}
                        {doc.doctor_name ? ` · ${doc.doctor_name}` : ""}
                        {doc.doctor_crm ? ` (CRM ${doc.doctor_crm})` : ""}
                        {doc.cid ? ` · CID ${doc.cid}` : ""}
                      </p>
                    </div>
                  </div>

                  {doc.items.length > 0 && (
                    <div className="mt-4 rounded-lg bg-secondary/50 p-3">
                      <ul className="space-y-1.5 text-sm">
                        {doc.items.map((it: any) => (
                          <li key={it.id} className="flex justify-between gap-3">
                            <span className="font-medium">{it.name}</span>
                            <span className="text-muted-foreground text-right">
                              {it.kind === "med"
                                ? [it.dosage, it.route].filter(Boolean).join(" · ")
                                : [it.value, it.unit].filter(Boolean).join(" ") +
                                  (it.reference_range ? ` (ref: ${it.reference_range})` : "")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {doc.signed_url && (
                    <div className="mt-4">
                      <a
                        href={doc.signed_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary underline underline-offset-4"
                      >
                        Ver documento original
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
