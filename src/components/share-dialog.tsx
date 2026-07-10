import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";

export function ShareDialog({
  open, onOpenChange, token, expiresAt,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  token: string;
  expiresAt: string | null;
}) {
  const [qr, setQr] = useState<string>("");
  const url = typeof window !== "undefined" ? `${window.location.origin}/s/${token}` : "";

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#2d3d33", light: "#f7f4ea" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [url]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Compartilhar com médico</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center">
            {qr ? (
              <img src={qr} alt="QR code do link" className="rounded-lg border border-border" />
            ) : (
              <div className="size-56 rounded-lg bg-muted animate-pulse" />
            )}
          </div>
          <div className="rounded-lg bg-secondary/60 p-3 text-xs break-all">{url}</div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado"); }}>
              <Copy className="size-4" /> Copiar
            </Button>
            <Button asChild variant="outline">
              <a href={url} target="_blank" rel="noreferrer" aria-label="Abrir link"><ExternalLink className="size-4" /></a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {expiresAt ? `Válido até ${new Date(expiresAt).toLocaleString("pt-BR")}` : "Sem expiração — revogue quando quiser."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
