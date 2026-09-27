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
  { icon: FolderOpen, title: "Tudo num só lugar", text: "Fotografe o documento, o app organiza por tipo e data." },
  { icon: History, title: "Linha do tempo do tratamento", text: "O que já foi feito, quando e por quem." },
  { icon: Share2, title: "Pronto para a consulta", text: "Compartilhe com o médico por link ou QR code." },
  { icon: ShieldCheck, title: "Você decide quem vê", text: "Acesso só por links que você cria e pode cancelar." },
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
      <header className="px-5 py-4 lg:px-12 lg:py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-primary">
          <HeartPulse className="size-6" aria-hidden />
          <span className="font-serif text-xl">Meddocs</span>
        </Link>
      </header>

      <main className="flex-1 px-5 pb-10 lg:flex lg:items-center lg:px-12 lg:pb-12">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16">
          <section>
            <h1 className="font-serif text-[1.65rem] leading-tight sm:text-3xl lg:text-4xl xl:text-[2.6rem] lg:max-w-xl">
              Vocês já têm preocupações demais. Organizar papel não precisa ser uma delas.
            </h1>
            {/* Celular: uma linha só */}
            <p className="mt-3 text-sm text-muted-foreground lg:hidden">
              Exames, laudos e receitas organizados e prontos para mostrar ao médico.
            </p>
            {/* Computador: explicação completa + benefícios */}
            <p className="mt-4 hidden max-w-xl text-lg text-muted-foreground lg:block">
              Para pacientes e familiares que acompanham um tratamento: todos os documentos
              organizados, com a história completa pronta para qualquer médico.
            </p>
            <ul className="mt-8 hidden grid-cols-2 gap-x-8 gap-y-6 lg:grid">
              {BENEFITS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="w-full sm:mx-auto sm:max-w-md lg:mx-0 lg:justify-self-end">
            <div className="sm:rounded-2xl sm:border sm:bg-card sm:p-8 sm:shadow-sm">
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

          {/* Celular: benefícios enxutos, abaixo do formulário */}
          <ul className="space-y-3 border-t pt-6 lg:hidden">
            {BENEFITS.map(({ icon: Icon, title }) => (
              <li key={title} className="flex items-center gap-3 text-sm">
                <Icon className="size-[18px] shrink-0 text-primary" aria-hidden />
                <span>{title}</span>
              </li>
            ))}
          </ul>
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
