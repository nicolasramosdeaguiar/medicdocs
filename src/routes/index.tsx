import { createFileRoute, redirect } from "@tanstack/react-router";

// Home page: send visitors either to the timeline or to sign-in.
// Runs client-side (SSR off) because Supabase session lives in localStorage.
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Meddocs — Seus documentos de saúde" },
    { name: "description", content: "Organize e compartilhe seus documentos de saúde com segurança." },
    { property: "og:title", content: "Meddocs — Seus documentos de saúde" },
    { property: "og:description", content: "Organize e compartilhe seus documentos de saúde com segurança." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/timeline" });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
