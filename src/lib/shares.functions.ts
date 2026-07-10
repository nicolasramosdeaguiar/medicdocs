import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const createInput = z.object({
  scope: z.enum(["all", "document"]),
  document_id: z.string().uuid().nullable().optional(),
  ttl_hours: z.number().int().min(0).max(24 * 30),
  // 0 => sem expiração (até revogar)
});

export const createShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => createInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const expires_at = data.ttl_hours > 0 ? new Date(Date.now() + data.ttl_hours * 3600_000).toISOString() : null;
    const doc = data.scope === "document" ? data.document_id ?? null : null;
    if (data.scope === "document" && !doc) throw new Error("document_id é obrigatório para escopo 'document'");

    const { data: row, error } = await supabase
      .from("shares")
      .insert({
        user_id: userId,
        scope: data.scope,
        document_id: doc,
        expires_at,
      })
      .select("id, token, expires_at, scope, document_id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Falha ao criar link");
    return row;
  });

export const listShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("shares")
      .select("id, token, scope, document_id, expires_at, revoked_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const revokeShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Público (sem auth): resolve um token e devolve os documentos com URLs assinadas. */
export const viewShare = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => z.object({ token: z.string().uuid() }).parse(v))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: share } = await supabaseAdmin
      .from("shares")
      .select("id, user_id, scope, document_id, expires_at, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!share) return { valid: false as const, reason: "not_found" as const };
    if (share.revoked_at) return { valid: false as const, reason: "revoked" as const };
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now())
      return { valid: false as const, reason: "expired" as const };

    let docsQuery = supabaseAdmin
      .from("documents")
      .select("id, doc_type, doc_date, doctor_name, doctor_crm, summary, cid, file_path, mime_type, created_at")
      .eq("user_id", share.user_id)
      .order("doc_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (share.scope === "document" && share.document_id) {
      docsQuery = docsQuery.eq("id", share.document_id);
    }
    const { data: docs } = await docsQuery;
    const docList = docs ?? [];
    const ids = docList.map((d) => d.id);
    const { data: items } = ids.length
      ? await supabaseAdmin.from("document_items").select("*").in("document_id", ids).order("order_index")
      : { data: [] };

    // Signed URLs para arquivos originais
    const signed = await Promise.all(
      docList.map(async (d) => {
        const s = await supabaseAdmin.storage.from("medical-docs").createSignedUrl(d.file_path, 60 * 30);
        return { id: d.id, url: s.data?.signedUrl ?? null };
      }),
    );
    const urlById = new Map(signed.map((x) => [x.id, x.url]));

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", share.user_id)
      .maybeSingle();

    return {
      valid: true as const,
      patient_name: profile?.full_name ?? null,
      scope: share.scope,
      expires_at: share.expires_at,
      documents: docList.map((d) => ({
        ...d,
        signed_url: urlById.get(d.id) ?? null,
        items: (items ?? []).filter((i) => i.document_id === d.id),
      })),
    };
  });
