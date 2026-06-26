import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------------- Contacts ---------------- */

export const upsertContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        workspaceId: z.string().uuid(),
        fullName: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(200).optional().nullable(),
        phone: z.string().trim().max(40).optional().nullable(),
        company: z.string().trim().max(120).optional().nullable(),
        jobTitle: z.string().trim().max(120).optional().nullable(),
        source: z.string().trim().max(60).optional().nullable(),
        status: z.enum(["lead", "qualified", "customer", "lost"]).default("lead"),
        score: z.number().int().min(0).max(100).default(0),
        tags: z.array(z.string().max(40)).max(20).default([]),
        notes: z.string().max(5000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const row = {
      workspace_id: data.workspaceId,
      created_by: context.userId,
      full_name: data.fullName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      company: data.company ?? null,
      job_title: data.jobTitle ?? null,
      source: data.source ?? null,
      status: data.status,
      score: data.score,
      tags: data.tags,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { data: updated, error } = await context.supabase
        .from("crm_contacts")
        .update(row)
        .eq("id", data.id)
        .eq("workspace_id", data.workspaceId)
        .select("id")
        .single();
      if (error) throw error;
      return { id: updated.id };
    }
    const { data: ins, error } = await context.supabase
      .from("crm_contacts")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("crm_contacts")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- Deals ---------------- */

export const upsertDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        workspaceId: z.string().uuid(),
        contactId: z.string().uuid().optional().nullable(),
        stageId: z.string().uuid().optional().nullable(),
        title: z.string().trim().min(1).max(160),
        value: z.number().min(0).max(1e12).default(0),
        currency: z.string().length(3).default("BRL"),
        probability: z.number().int().min(0).max(100).default(50),
        expectedCloseDate: z.string().optional().nullable(),
        status: z.enum(["open", "won", "lost"]).default("open"),
        notes: z.string().max(5000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const row = {
      workspace_id: data.workspaceId,
      contact_id: data.contactId ?? null,
      stage_id: data.stageId ?? null,
      owner_id: context.userId,
      title: data.title,
      value: data.value,
      currency: data.currency,
      probability: data.probability,
      expected_close_date: data.expectedCloseDate ?? null,
      status: data.status,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { data: u, error } = await context.supabase
        .from("crm_deals")
        .update(row)
        .eq("id", data.id)
        .eq("workspace_id", data.workspaceId)
        .select("id")
        .single();
      if (error) throw error;
      return { id: u.id };
    }
    const { data: ins, error } = await context.supabase
      .from("crm_deals")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

export const moveDealStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        dealId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        stageId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("crm_deals")
      .update({ stage_id: data.stageId })
      .eq("id", data.dealId)
      .eq("workspace_id", data.workspaceId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("crm_deals")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- Activities ---------------- */

export const addActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        contactId: z.string().uuid().optional().nullable(),
        dealId: z.string().uuid().optional().nullable(),
        type: z.enum(["note", "call", "email", "meeting", "task", "agent"]).default("note"),
        title: z.string().trim().min(1).max(160),
        body: z.string().max(5000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ins, error } = await context.supabase
      .from("crm_activities")
      .insert({
        workspace_id: data.workspaceId,
        contact_id: data.contactId ?? null,
        deal_id: data.dealId ?? null,
        user_id: context.userId,
        type: data.type,
        title: data.title,
        body: data.body ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

/* ---------------- Stages ---------------- */

export const upsertStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        workspaceId: z.string().uuid(),
        name: z.string().trim().min(1).max(60),
        position: z.number().int().min(0).max(50),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0e7490"),
        isWon: z.boolean().default(false),
        isLost: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const row = {
      workspace_id: data.workspaceId,
      name: data.name,
      position: data.position,
      color: data.color,
      is_won: data.isWon,
      is_lost: data.isLost,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("crm_pipeline_stages")
        .update(row)
        .eq("id", data.id)
        .eq("workspace_id", data.workspaceId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("crm_pipeline_stages")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), workspaceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("crm_pipeline_stages")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw error;
    return { ok: true };
  });
