import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Read the workspace's WhatsApp integration (without exposing the access token). */
export const getWhatsAppIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("whatsapp_integrations")
      .select(
        "id, workspace_id, phone_number_id, business_account_id, display_phone_number, verify_token, default_agent_id, is_active, created_at, updated_at",
      )
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const upsertWhatsAppIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        phoneNumberId: z.string().trim().min(1).max(80),
        businessAccountId: z.string().trim().max(80).optional().nullable(),
        displayPhoneNumber: z.string().trim().max(40).optional().nullable(),
        accessToken: z.string().trim().min(20).max(2000),
        verifyToken: z.string().trim().min(6).max(120),
        appSecret: z.string().trim().max(200).optional().nullable(),
        defaultAgentId: z.string().uuid().optional().nullable(),
        isActive: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const row = {
      workspace_id: data.workspaceId,
      phone_number_id: data.phoneNumberId,
      business_account_id: data.businessAccountId ?? null,
      display_phone_number: data.displayPhoneNumber ?? null,
      access_token: data.accessToken,
      verify_token: data.verifyToken,
      app_secret: data.appSecret ?? null,
      default_agent_id: data.defaultAgentId ?? null,
      is_active: data.isActive,
    };
    const { error } = await context.supabase
      .from("whatsapp_integrations")
      .upsert(row, { onConflict: "workspace_id" });
    if (error) throw error;
    return { ok: true };
  });

export const deleteWhatsAppIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("whatsapp_integrations")
      .delete()
      .eq("workspace_id", data.workspaceId);
    if (error) throw error;
    return { ok: true };
  });

export const listWhatsAppMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        contactId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("whatsapp_messages")
      .select("id, direction, from_phone, to_phone, body, status, created_at, contact_id, wa_message_id")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.contactId) q = q.eq("contact_id", data.contactId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

/** Send a WhatsApp text message via Meta Cloud API. */
export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        toPhone: z.string().trim().min(8).max(40),
        body: z.string().trim().min(1).max(4000),
        contactId: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: integ, error } = await context.supabase
      .from("whatsapp_integrations")
      .select("phone_number_id, access_token, is_active")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (error) throw error;
    if (!integ || !integ.is_active) {
      throw new Error("Integração com WhatsApp não configurada para este workspace.");
    }

    const cleanedPhone = data.toPhone.replace(/[^\d]/g, "");

    const res = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(integ.phone_number_id)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${integ.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanedPhone,
          type: "text",
          text: { body: data.body },
        }),
      },
    );

    const json = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(
        `Falha ao enviar via WhatsApp (HTTP ${res.status}): ${
          json?.error?.message ?? "erro desconhecido"
        }`,
      );
    }

    const waId = json?.messages?.[0]?.id ?? null;

    await context.supabase.from("whatsapp_messages").insert({
      workspace_id: data.workspaceId,
      contact_id: data.contactId ?? null,
      direction: "outbound",
      to_phone: cleanedPhone,
      body: data.body,
      status: "sent",
      wa_message_id: waId,
      raw: JSON.parse(JSON.stringify(json)),
    });

    return { ok: true, waMessageId: waId };
  });
