import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLE_ENUM = z.enum(["owner", "admin", "member"]);

async function assertAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  workspaceId: string,
  userId: string,
) {
  const { data } = await supabase.rpc("workspace_role_of", { _ws: workspaceId, _uid: userId });
  if (data !== "owner" && data !== "admin") throw new Error("Sem permissão");
  return data as "owner" | "admin";
}

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(2).max(60) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const slug =
      data.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30) || "ws";

    const finalSlug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: ws, error } = await context.supabase
      .from("workspaces")
      .insert({ name: data.name, slug: finalSlug, created_by: context.userId })
      .select("id, name, slug")
      .single();
    if (error) throw error;

    const { error: memErr } = await context.supabase
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: context.userId, role: "owner" });
    if (memErr) throw memErr;

    return ws;
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        email: z.string().trim().toLowerCase().email().max(255),
        role: ROLE_ENUM.exclude(["owner"]).default("member"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, data.workspaceId, context.userId);

    const { data: invite, error } = await context.supabase
      .from("workspace_invites")
      .insert({
        workspace_id: data.workspaceId,
        email: data.email,
        role: data.role,
        invited_by: context.userId,
      })
      .select("id, token, email, role, expires_at")
      .single();
    if (error) throw error;
    return invite;
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(8).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: invite, error: invErr } = await context.supabase
      .from("workspace_invites")
      .select("id, workspace_id, email, role, expires_at, accepted_at")
      .eq("token", data.token)
      .maybeSingle();

    if (invErr || !invite) throw new Error("Convite inválido");
    if (invite.accepted_at) throw new Error("Convite já utilizado");
    if (new Date(invite.expires_at) < new Date()) throw new Error("Convite expirado");

    const userEmail = (context.claims?.email as string | undefined)?.toLowerCase();
    if (userEmail && userEmail !== invite.email.toLowerCase()) {
      throw new Error(`Este convite é para ${invite.email}. Entre com a conta correta.`);
    }

    // Insert membership (idempotent via UNIQUE constraint)
    const { error: memErr } = await context.supabase
      .from("workspace_members")
      .insert({ workspace_id: invite.workspace_id, user_id: context.userId, role: invite.role });
    if (memErr && !String(memErr.message ?? "").includes("duplicate")) throw memErr;

    await context.supabase
      .from("workspace_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return { workspaceId: invite.workspace_id };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid(), userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.userId !== context.userId) {
      await assertAdmin(context.supabase, data.workspaceId, context.userId);
    }
    const { error } = await context.supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const changeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
        role: ROLE_ENUM,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const callerRole = await assertAdmin(context.supabase, data.workspaceId, context.userId);
    if (data.role === "owner" && callerRole !== "owner") {
      throw new Error("Apenas o dono pode promover outro dono");
    }
    const { error } = await context.supabase
      .from("workspace_members")
      .update({ role: data.role })
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ inviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_invites")
      .delete()
      .eq("id", data.inviteId);
    if (error) throw error;
    return { ok: true };
  });
