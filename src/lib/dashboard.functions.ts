import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, docsRes] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", userId).single(),
      supabase
        .from("documents")
        .select(
          "id, doc_type, doc_date, doctor_name, title, summary, confidence, cid, created_at",
        )
        .eq("user_id", userId)
        .order("doc_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const docs = docsRes.data ?? [];

    const docIds = docs.map((d) => d.id);
    let meds: { name: string; dosage: string | null; route: string | null; document_id: string }[] = [];
    if (docIds.length > 0) {
      const { data: items } = await supabase
        .from("document_items")
        .select("name, dosage, route, document_id")
        .in("document_id", docIds)
        .eq("kind", "med")
        .order("order_index");
      meds = (items ?? []) as typeof meds;
    }

    return { fullName: (profileRes.data?.full_name as string | null) ?? null, docs, meds };
  });
