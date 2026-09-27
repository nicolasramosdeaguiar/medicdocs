import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  HeartPulse,
  FolderOpen,
  History,
  Share2,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Meddocs" },
      {
        name: "description",
        content:
          "Exames, laudos, receitas e encaminhamentos organizados num só lugar, prontos para mostrar ao médico.",
      },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres").max(72),
});

const RELATIONSHIPS = [
  "Mãe",
  "Pai",
  "Cônjuge ou companheiro(a)",
  "Filho(a)",
  "Irmão(ã)",
  "Avô/Avó",
  "Outro",
] as const;

const signUpSchema = signInSchema
  .extend({
    full_name: z.string().trim().min(1, "Informe seu nome").max(120),
    account_for: z.enum(["self", "family"]),
    patient_name: z.string().trim().max(120).optional(),
    patient_relationship: z.string().trim().max(60).optional(),
    consent: z.literal(true, {
      errorMap: () => ({ message: "Para continuar, confirme o aceite no final do formulário" }),
    }),
  })
  .refine((v) => v.account_for === "self" || (v.patient_name && v.patient_name.length > 0), {
    message: "Informe o nome da pessoa que você cuida",
    path: ["patient_name"],
  });

const BENEFITS = [
  {
    icon: FolderOpen,
    title: "Tudo num só lugar",
    text: "Fotografe exames, laudos, receitas e encaminhamentos. O app lê o documento e organiza por tipo e data.",
  },
  {
    icon: History,
    title: "A história do tratamento em ordem",
    text: "Uma linha do tempo com o que já foi feito, quando e por quem. Sem precisar lembrar de cabeça.",
  },
  {
    icon: Share2,
    title: "Pronto para a consulta",
    text: "Compartilhe com o médico por link ou QR code. Você escolhe por quanto tempo e pode cancelar quando quiser.",
  },
  {
    icon: ShieldCheck,
    title: "Só você decide quem vê",
    text: "Os documentos ficam na sua conta. Ninguém acessa sem um link que você mesmo criou.",
  },
];

function AuthPage() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/timeline", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-6 py-6 lg:px-12">
        <Link to="/" className="inline-flex items-center gap-2 text-primary">
          <HeartPulse className="size-6" aria-hidden />
          <span className="font-serif text-xl">Meddocs</span>
        </Link>
      </header>

      <main className="flex-1 px-6 pb-16 lg:px-12">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:items-start lg:pt-8">
          {/* Apresentação: no celular aparece só o título aqui; os benefícios vão para baixo do formulário */}
          <section className="lg:pt-4">
            <h1 className="font-serif text-3xl leading-tight sm:text-4xl lg:text-5xl">
              Vocês já têm preocupações demais. Organizar papel não precisa ser uma delas.
            </h1>
            <p className="mt-4 max-w-prose text-base text-muted-foreground lg:text-lg">
              Para pacientes e familiares que acompanham um tratamento: todos os exames, laudos e
              receitas organizados, com a história completa pronta para mostrar a qualquer médico.
            </p>
            <BenefitList className="mt-10 hidden lg:block" />
          </section>

          <section className="w-full max-w-md lg:justify-self-end">
            <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
              <Tabs defaultValue="signin">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="signin">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Criar conta</TabsTrigger>
                </TabsList>
                <TabsContent value="signin"><SignInForm /></TabsContent>
                <TabsContent value="signup"><SignUpForm /></TabsContent>
              </Tabs>
            </div>
          </section>

          <BenefitList className="lg:hidden" />
        </div>
      </main>
    </div>
  );
}

function BenefitList({ className = "" }: { className?: string }) {
  return (
    <ul className={`space-y-6 ${className}`}>
      {BENEFITS.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-4">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-prose">{text}</p>
          </div>
        </li>
      ))}
    </ul>
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

type AccountFor = "self" | "family";

function SignUpForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({
    full_name: "",
    email: "",
    password: "",
    account_for: "self" as AccountFor,
    patient_name: "",
    patient_relationship: "",
    consent: false,
  });

  const isFamily = values.account_for === "family";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    const d = parsed.data;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        // Guardado nos metadados do usuário por enquanto.
        // Próximo passo: tabela "patients" separada da conta.
        data: {
          full_name: d.full_name,
          account_for: d.account_for,
          patient_name: d.account_for === "self" ? d.full_name : d.patient_name,
          patient_relationship: d.account_for === "self" ? "self" : d.patient_relationship || null,
          consent_at: new Date().toISOString(),
        },
        emailRedirectTo: `${window.location.origin}/timeline`,
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      toast.error("Já existe uma conta com esse email. Use a aba “Entrar” ou “Esqueci minha senha”.");
      return;
    }
    if (!data.session) {
      toast.success("Conta criada! Confirme seu email pelo link que enviamos para entrar.");
      return;
    }
    toast.success("Conta criada! Bem-vindo.");
    navigate({ to: "/timeline", replace: true });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Para quem é o histórico?</legend>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <AccountForOption
            selected={!isFamily}
            onSelect={() => setValues((v) => ({ ...v, account_for: "self" }))}
            icon={User}
            title="Para mim"
            text="Sou o paciente"
          />
          <AccountForOption
            selected={isFamily}
            onSelect={() => setValues((v) => ({ ...v, account_for: "family" }))}
            icon={Users}
            title="Cuido de alguém"
            text="Sou familiar ou cuidador"
          />
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="signup-name">Seu nome</Label>
        <Input id="signup-name" autoComplete="name" required
          value={values.full_name} onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))} />
      </div>

      {isFamily && (
        <div className="space-y-4 rounded-xl bg-muted/60 p-4">
          <div className="space-y-2">
            <Label htmlFor="signup-patient-name">Nome de quem você cuida</Label>
            <Input id="signup-patient-name" autoComplete="off" required
              value={values.patient_name}
              onChange={(e) => setValues((v) => ({ ...v, patient_name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-relationship">
              Essa pessoa é sua… <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <select
              id="signup-relationship"
              value={values.patient_relationship}
              onChange={(e) => setValues((v) => ({ ...v, patient_relationship: e.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecione</option>
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Depois você pode adicionar outras pessoas que cuida.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="signup-email">Seu email</Label>
        <Input id="signup-email" type="email" autoComplete="email" required
          value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Senha</Label>
        <Input id="signup-password" type="password" autoComplete="new-password" required
          value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} />
        <p className="text-xs text-muted-foreground">Mínimo 6 caracteres.</p>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="signup-consent"
          checked={values.consent}
          onCheckedChange={(c) => setValues((v) => ({ ...v, consent: c === true }))}
          className="mt-0.5"
        />
        <Label htmlFor="signup-consent" className="text-sm font-normal leading-snug text-muted-foreground">
          {isFamily
            ? "Declaro que sou responsável por essa pessoa ou tenho autorização dela para guardar seus documentos de saúde, e concordo com os Termos de Uso e a Política de Privacidade."
            : "Autorizo o armazenamento dos meus documentos de saúde e concordo com os Termos de Uso e a Política de Privacidade."}
        </Label>
      </div>

      <Button type="submit" className="w-full h-11" disabled={loading}>
        {loading ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}

function AccountForOption({
  selected,
  onSelect,
  icon: Icon,
  title,
  text,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: typeof User;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected
          ? "border-primary bg-primary/10"
          : "border-input bg-background hover:bg-muted/60"
      }`}
    >
      <Icon className={`size-5 ${selected ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{text}</span>
    </button>
  );
}
