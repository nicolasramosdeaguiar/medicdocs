import { createFileRoute, redirect } from "@tanstack/react-router";

// Home page: send visitors either to the timeline or to sign-in.
// Runs client-side (SSR off) because Supabase session lives in localStorage.
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/timeline" });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
