import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HeartPulse } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Definir nova senha — Meddocs" },
      { name: "description", content: "Escolha uma nova senha para acessar seu histórico de saúde no Meddocs." },
      { property: "og:title", content: "Definir nova senha — Meddocs" },
      { property: "og:description", content: "Escolha uma nova senha para sua conta Meddocs." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Mínimo 6 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada!");
    navigate({ to: "/timeline", replace: true });
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-6 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-primary">
          <HeartPulse className="size-6" />
          <span className="font-serif text-xl">Meddocs</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
          <div className="mb-4 text-center">
            <h1 className="text-3xl">Nova senha</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Escolha uma senha para entrar na sua conta.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Senha</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
          </div>
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "Salvando…" : "Salvar senha"}
          </Button>
          <Link to="/auth" className="block text-center text-sm text-muted-foreground underline">
            Voltar para entrar
          </Link>
        </form>
      </main>
    </div>
  );
}
