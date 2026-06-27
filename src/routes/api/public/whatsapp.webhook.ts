import { createFileRoute } from "@tanstack/react-router";

/**
 * Public webhook for WhatsApp Business (Meta Cloud API).
 *
 * GET  — verification handshake. Meta sends:
 *        ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 *        We respond with the challenge plain-text when the verify_token matches
 *        ANY active integration in any workspace.
 *
 * POST — inbound message events. We persist messages and upsert a CRM contact
 *        keyed by phone number (per workspace).
 *
 * NOTE: Auto-replies via the configured `default_agent_id` are intentionally
 * out of scope for this handler; mark TODO below to wire later.
 */
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (mode !== "subscribe" || !token || !challenge) {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { data, error } = await supabaseAdmin
          .from("whatsapp_integrations")
          .select("id")
          .eq("verify_token", token)
          .eq("is_active", true)
          .limit(1);

        if (error || !data || data.length === 0) {
          return new Response("Forbidden", { status: 403 });
        }
        return new Response(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      },

      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const entries =
          (payload as { entry?: Array<Record<string, unknown>> })?.entry ?? [];

        for (const entry of entries) {
          const changes =
            (entry as { changes?: Array<Record<string, unknown>> })?.changes ??
            [];
          for (const change of changes) {
            const value = (change as { value?: Record<string, unknown> })
              ?.value;
            if (!value) continue;

            const metadata = value.metadata as
              | { phone_number_id?: string; display_phone_number?: string }
              | undefined;
            const phoneNumberId = metadata?.phone_number_id;
            if (!phoneNumberId) continue;

            const { data: integ } = await supabaseAdmin
              .from("whatsapp_integrations")
              .select("id, workspace_id, is_active")
              .eq("phone_number_id", phoneNumberId)
              .maybeSingle();
            if (!integ || !integ.is_active) continue;

            // Inbound messages
            const messages =
              (value.messages as
                | Array<{
                    id?: string;
                    from?: string;
                    text?: { body?: string };
                    type?: string;
                  }>
                | undefined) ?? [];
            const contacts =
              (value.contacts as
                | Array<{ profile?: { name?: string }; wa_id?: string }>
                | undefined) ?? [];

            for (const msg of messages) {
              const fromPhone = msg.from ?? null;
              const body =
                msg.type === "text" ? msg.text?.body ?? "" : `[${msg.type ?? "media"}]`;

              // Upsert contact by phone, scoped to workspace
              let contactId: string | null = null;
              if (fromPhone) {
                const profileName =
                  contacts.find((c) => c.wa_id === fromPhone)?.profile?.name ??
                  fromPhone;

                const { data: existing } = await supabaseAdmin
                  .from("crm_contacts")
                  .select("id")
                  .eq("workspace_id", integ.workspace_id)
                  .eq("phone", fromPhone)
                  .maybeSingle();

                if (existing) {
                  contactId = existing.id;
                } else {
                  const { data: created } = await supabaseAdmin
                    .from("crm_contacts")
                    .insert({
                      workspace_id: integ.workspace_id,
                      full_name: profileName,
                      phone: fromPhone,
                      source: "whatsapp",
                      status: "lead",
                    })
                    .select("id")
                    .single();
                  contactId = created?.id ?? null;
                }
              }

              await supabaseAdmin.from("whatsapp_messages").insert({
                workspace_id: integ.workspace_id,
                contact_id: contactId,
                direction: "inbound",
                wa_message_id: msg.id ?? null,
                from_phone: fromPhone,
                to_phone: metadata?.display_phone_number ?? null,
                body,
                status: "received",
                raw: msg as unknown as Record<string, unknown>,
              });
              // TODO: optional auto-reply via integ.default_agent_id
            }

            // Status updates (delivered/read/etc.)
            const statuses =
              (value.statuses as
                | Array<{ id?: string; status?: string }>
                | undefined) ?? [];
            for (const s of statuses) {
              if (!s.id || !s.status) continue;
              await supabaseAdmin
                .from("whatsapp_messages")
                .update({ status: s.status })
                .eq("wa_message_id", s.id)
                .eq("workspace_id", integ.workspace_id);
            }
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
