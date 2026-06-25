import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AUDIT_ACTIONS = [
  "auth.login.success",
  "auth.logout",
  "auth.password_updated",
  "auth.captcha_failed",
  "agent.created",
  "agent.updated",
  "agent.deleted",
  "agent.executed",
  "document.uploaded",
  "document.deleted",
  "workspace.created",
  "workspace.updated",
  "member.invited",
  "member.joined",
  "member.removed",
  "member.role_changed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const logAuditEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid().nullable().optional(),
        action: z.enum(AUDIT_ACTIONS),
        resourceType: z.string().max(50).optional(),
        resourceId: z.string().max(120).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let ip: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {
      /* noop */
    }
    let ua: string | null = null;
    try {
      ua = getRequestHeader("user-agent") ?? null;
    } catch {
      /* noop */
    }

    const email = (context.claims?.email as string | undefined) ?? null;

    const { error } = await context.supabase.from("audit_logs").insert({
      workspace_id: data.workspaceId ?? null,
      actor_user_id: context.userId,
      actor_email: email,
      action: data.action,
      resource_type: data.resourceType ?? null,
      resource_id: data.resourceId ?? null,
      metadata: (data.metadata ?? {}) as Record<string, unknown> as never,
      ip,
      user_agent: ua,
    });

    if (error) {
      console.error("audit log failed", error);
      return { ok: false };
    }
    return { ok: true };
  });
