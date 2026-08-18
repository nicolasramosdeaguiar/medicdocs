import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HeartPulse } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Meddocs" },
      { name: "description", content: "Acesse seu histórico de saúde no Meddocs." },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});
const signUpSchema = signInSchema.extend({
  full_name: z.string().trim().min(1, "Informe seu nome").max(120),
});

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/timeline", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-6 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-primary">
          <HeartPulse className="size-6" />
          <span className="font-serif text-xl">Meddocs</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-3xl">Seu histórico, no seu bolso</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Guarde exames, receitas e laudos num só lugar.
            </p>
          </div>
          <Tabs defaultValue="signin">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin"><SignInForm /></TabsContent>
            <TabsContent value="signup"><SignUpForm /></TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({ email: "", password: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signInSchema.safeParse(values);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        toast.error("Email ou senha incorretos. Se você já tinha conta, use “Esqueci minha senha”.");
      } else if (error.message.toLowerCase().includes("not confirmed")) {
        toast.error("Confirme seu email pelo link que enviamos antes de entrar.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    navigate({ to: "/timeline", replace: true });
  }

  async function onForgot() {
    const email = values.email.trim();
    if (!z.string().email().safeParse(email).success) {
      toast.error("Digite seu email acima para receber o link de redefinição.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Enviamos um link para redefinir sua senha.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" autoComplete="email" required
          value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Senha</Label>
        <Input id="signin-password" type="password" autoComplete="current-password" required
          value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} />
      </div>
      <Button type="submit" className="w-full h-11" disabled={loading}>
        {loading ? "Entrando…" : "Entrar"}
      </Button>
      <button type="button" onClick={onForgot} disabled={loading}
        className="block w-full text-center text-sm text-muted-foreground underline">
        Esqueci minha senha
      </button>
    </form>
  );
}


function SignUpForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({ full_name: "", email: "", password: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.full_name },
        emailRedirectTo: `${window.location.origin}/timeline`,
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada! Bem-vindo.");
    navigate({ to: "/timeline", replace: true });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-name">Nome</Label>
        <Input id="signup-name" autoComplete="name" required
          value={values.full_name} onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" type="email" autoComplete="email" required
          value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Senha</Label>
        <Input id="signup-password" type="password" autoComplete="new-password" required
          value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} />
        <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
      </div>
      <Button type="submit" className="w-full h-11" disabled={loading}>
        {loading ? "Criando…" : "Criar conta"}
      </Button>
    </form>
  );
}
