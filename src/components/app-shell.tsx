import { Link, useNavigate } from "@tanstack/react-router";
import { HeartPulse, Link2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link to="/timeline" className="inline-flex items-center gap-2 text-primary">
            <HeartPulse className="size-5" />
            <span className="font-serif text-lg">Meddocs</span>
          </Link>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/shares"><Link2 className="size-4" /><span className="sr-only sm:not-sr-only sm:ml-2">Links</span></Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sair">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-2xl px-4 pb-24 pt-4">{children}</main>
    </div>
  );
}
