
-- ============ CRM CONTACTS ============
CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  company text,
  job_title text,
  source text,
  status text NOT NULL DEFAULT 'lead',
  score int NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_contacts_workspace ON public.crm_contacts(workspace_id);
CREATE INDEX idx_crm_contacts_email ON public.crm_contacts(workspace_id, email);
CREATE INDEX idx_crm_contacts_status ON public.crm_contacts(workspace_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_contacts_member_all" ON public.crm_contacts
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- ============ PIPELINE STAGES ============
CREATE TABLE public.crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#0e7490',
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pipeline_stages_workspace ON public.crm_pipeline_stages(workspace_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipeline_stages TO authenticated;
GRANT ALL ON public.crm_pipeline_stages TO service_role;
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_stages_member_all" ON public.crm_pipeline_stages
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- ============ DEALS ============
CREATE TABLE public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  value numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  probability int NOT NULL DEFAULT 50,
  expected_close_date date,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_deals_workspace ON public.crm_deals(workspace_id);
CREATE INDEX idx_crm_deals_stage ON public.crm_deals(stage_id);
CREATE INDEX idx_crm_deals_contact ON public.crm_deals(contact_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_deals TO authenticated;
GRANT ALL ON public.crm_deals TO service_role;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_deals_member_all" ON public.crm_deals
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- ============ ACTIVITIES ============
CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_activities_workspace ON public.crm_activities(workspace_id, created_at DESC);
CREATE INDEX idx_crm_activities_contact ON public.crm_activities(contact_id, created_at DESC);
CREATE INDEX idx_crm_activities_deal ON public.crm_activities(deal_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_activities_member_all" ON public.crm_activities
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

-- ============ updated_at triggers ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_crm_contacts_updated BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_crm_deals_updated BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Seed default stages for new workspaces ============
CREATE OR REPLACE FUNCTION public.seed_default_pipeline_stages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.crm_pipeline_stages(workspace_id, name, position, color, is_won, is_lost) VALUES
    (NEW.id, 'Novo', 0, '#64748b', false, false),
    (NEW.id, 'Contato feito', 1, '#0e7490', false, false),
    (NEW.id, 'Proposta', 2, '#0891b2', false, false),
    (NEW.id, 'Negociação', 3, '#0d9488', false, false),
    (NEW.id, 'Ganho', 4, '#15803d', true, false);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_seed_pipeline_stages
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_pipeline_stages();

-- Backfill existing workspaces
INSERT INTO public.crm_pipeline_stages(workspace_id, name, position, color, is_won, is_lost)
SELECT w.id, s.name, s.position, s.color, s.is_won, s.is_lost
FROM public.workspaces w
CROSS JOIN (VALUES
  ('Novo', 0, '#64748b', false, false),
  ('Contato feito', 1, '#0e7490', false, false),
  ('Proposta', 2, '#0891b2', false, false),
  ('Negociação', 3, '#0d9488', false, false),
  ('Ganho', 4, '#15803d', true, false)
) AS s(name, position, color, is_won, is_lost)
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_pipeline_stages ps WHERE ps.workspace_id = w.id
);
