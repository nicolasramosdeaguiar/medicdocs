import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Camera, FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { uploadAndExtract } from "@/lib/documents.functions";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [
    { title: "Adicionar documento — Meddocs" },
    { name: "description", content: "Envie uma foto ou PDF para organizar seus dados de saúde." },
    { property: "og:title", content: "Adicionar documento — Meddocs" },
    { property: "og:description", content: "Envie uma foto ou PDF para organizar seus dados de saúde." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: UploadPage,
});

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function UploadPage() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const upload = useServerFn(uploadAndExtract);
  const [processing, setProcessing] = useState(false);
  const [phase, setPhase] = useState<string>("");

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo grande demais (máx. 8MB). Tente uma foto de menor resolução.");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato não suportado. Use foto (JPG/PNG) ou PDF.");
      return;
    }
    setProcessing(true);
    setPhase("Lendo arquivo…");
    try {
      const b64 = await toBase64(file);
      setPhase("A IA está lendo o documento…");
      const { id } = await upload({
        data: { file_base64: b64, mime_type: file.type, filename: file.name },
      });
      toast.success("Documento adicionado!");
      navigate({ to: "/documents/$id", params: { id }, search: { review: 1 } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio");
      setProcessing(false);
    }
  }

  if (processing) {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
          <div className="relative mb-6">
            <Loader2 className="size-12 text-primary animate-spin" />
          </div>
          <h1 className="text-xl">Processando seu documento</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            {phase} Isso costuma levar alguns segundos.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl mb-1">Adicionar documento</h1>
      <p className="text-muted-foreground mb-8">
        Escolha uma foto ou envie um arquivo. A IA vai identificar tipo, data e principais dados.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => cameraRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-center transition-colors hover:border-primary/40 hover:bg-secondary/40"
        >
          <Camera className="size-8 text-primary" />
          <span className="font-medium">Tirar foto</span>
          <span className="text-sm text-muted-foreground">Usar a câmera do celular</span>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-center transition-colors hover:border-primary/40 hover:bg-secondary/40"
        >
          <FileUp className="size-8 text-primary" />
          <span className="font-medium">Escolher arquivo</span>
          <span className="text-sm text-muted-foreground">PDF ou imagem no dispositivo</span>
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="mt-10 text-center">
        <Button variant="ghost" onClick={() => navigate({ to: "/timeline" })}>Cancelar</Button>
      </div>
    </AppShell>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    reader.onload = () => {
      const s = String(reader.result ?? "");
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.readAsDataURL(file);
  });
}
