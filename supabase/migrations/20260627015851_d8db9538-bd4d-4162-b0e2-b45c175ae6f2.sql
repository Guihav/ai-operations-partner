
CREATE TABLE public.whatsapp_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL,
  business_account_id text,
  display_phone_number text,
  access_token text NOT NULL,
  verify_token text NOT NULL,
  app_secret text,
  default_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_integrations TO authenticated;
GRANT ALL ON public.whatsapp_integrations TO service_role;
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws members manage whatsapp integration" ON public.whatsapp_integrations
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_whatsapp_integrations_updated_at
  BEFORE UPDATE ON public.whatsapp_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  wa_message_id text,
  from_phone text,
  to_phone text,
  body text,
  status text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws members read whatsapp messages" ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws members insert whatsapp messages" ON public.whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX whatsapp_messages_workspace_created_idx
  ON public.whatsapp_messages(workspace_id, created_at DESC);
CREATE INDEX whatsapp_messages_contact_idx
  ON public.whatsapp_messages(contact_id);
