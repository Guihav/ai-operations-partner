
-- =========================================================
-- 1. WORKSPACES & MEMBERSHIP
-- =========================================================

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invites TO authenticated;
GRANT SELECT ON public.workspace_invites TO anon;  -- needed to look up invite by token before login
GRANT ALL ON public.workspace_invites TO service_role;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

-- Security-definer helpers to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_workspace_member(_ws uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _ws AND user_id = _uid);
$$;

CREATE OR REPLACE FUNCTION public.workspace_role_of(_ws uuid, _uid uuid)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.workspace_members WHERE workspace_id = _ws AND user_id = _uid;
$$;

-- Policies
CREATE POLICY "ws read for members" ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(id, auth.uid()));
CREATE POLICY "ws create" ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "ws update by admin" ON public.workspaces FOR UPDATE TO authenticated
  USING (public.workspace_role_of(id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.workspace_role_of(id, auth.uid()) IN ('owner','admin'));
CREATE POLICY "ws delete by owner" ON public.workspaces FOR DELETE TO authenticated
  USING (public.workspace_role_of(id, auth.uid()) = 'owner');

CREATE POLICY "members read" ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "members self-insert via accept" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "members admin manage" ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'));
CREATE POLICY "members admin remove" ON public.workspace_members FOR DELETE TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin') OR user_id = auth.uid());

CREATE POLICY "invites read for workspace admin" ON public.workspace_invites FOR SELECT TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'));
CREATE POLICY "invites read by token anon" ON public.workspace_invites FOR SELECT TO anon
  USING (accepted_at IS NULL AND expires_at > now());
CREATE POLICY "invites create by admin" ON public.workspace_invites FOR INSERT TO authenticated
  WITH CHECK (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin') AND invited_by = auth.uid());
CREATE POLICY "invites update by admin or self-accept" ON public.workspace_invites FOR UPDATE TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin') OR accepted_at IS NULL);
CREATE POLICY "invites delete by admin" ON public.workspace_invites FOR DELETE TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'));

-- =========================================================
-- 2. ADD workspace_id TO EXISTING TABLES
-- =========================================================

ALTER TABLE public.agents ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.agent_documents ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.document_chunks ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.executions ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- =========================================================
-- 3. BACKFILL: 1 personal workspace per existing user
-- =========================================================

DO $$
DECLARE u record;
DECLARE ws_id uuid;
BEGIN
  FOR u IN SELECT DISTINCT owner_id AS uid FROM (
    SELECT owner_id FROM public.agents
    UNION SELECT owner_id FROM public.agent_documents
    UNION SELECT owner_id FROM public.executions
    UNION SELECT owner_id FROM public.conversations
    UNION SELECT id AS owner_id FROM public.profiles
  ) AS users WHERE owner_id IS NOT NULL
  LOOP
    INSERT INTO public.workspaces(name, slug, created_by)
    VALUES ('Pessoal', 'pessoal-' || substring(u.uid::text, 1, 8), u.uid)
    RETURNING id INTO ws_id;

    INSERT INTO public.workspace_members(workspace_id, user_id, role)
    VALUES (ws_id, u.uid, 'owner');

    UPDATE public.agents SET workspace_id = ws_id WHERE owner_id = u.uid AND workspace_id IS NULL;
    UPDATE public.agent_documents SET workspace_id = ws_id WHERE owner_id = u.uid AND workspace_id IS NULL;
    UPDATE public.document_chunks SET workspace_id = ws_id WHERE owner_id = u.uid AND workspace_id IS NULL;
    UPDATE public.conversations SET workspace_id = ws_id WHERE owner_id = u.uid AND workspace_id IS NULL;
    UPDATE public.messages SET workspace_id = ws_id WHERE owner_id = u.uid AND workspace_id IS NULL;
    UPDATE public.executions SET workspace_id = ws_id WHERE owner_id = u.uid AND workspace_id IS NULL;
  END LOOP;
END $$;

-- =========================================================
-- 4. REPLACE OLD POLICIES WITH WORKSPACE-BASED RLS
-- =========================================================

DROP POLICY IF EXISTS "agents owner all" ON public.agents;
DROP POLICY IF EXISTS "agent_documents owner all" ON public.agent_documents;
DROP POLICY IF EXISTS "document_chunks owner all" ON public.document_chunks;
DROP POLICY IF EXISTS "conversations owner all" ON public.conversations;
DROP POLICY IF EXISTS "messages owner all" ON public.messages;
DROP POLICY IF EXISTS "executions owner all" ON public.executions;

CREATE POLICY "agents workspace access" ON public.agents FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "agent_documents workspace access" ON public.agent_documents FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "document_chunks workspace access" ON public.document_chunks FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "conversations workspace access" ON public.conversations FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "messages workspace access" ON public.messages FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "executions workspace access" ON public.executions FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()));

-- Auto-create workspace for new users via signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws_id uuid;
BEGIN
  INSERT INTO public.workspaces(name, slug, created_by)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company_name', 'Meu workspace'),
    'ws-' || substring(NEW.id::text, 1, 8) || '-' || substring(md5(random()::text), 1, 4),
    NEW.id
  )
  RETURNING id INTO ws_id;

  INSERT INTO public.workspace_members(workspace_id, user_id, role)
  VALUES (ws_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_workspace ON auth.users;
CREATE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_workspace();

-- =========================================================
-- 5. AUDIT LOGS
-- =========================================================

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit read by workspace members" ON public.audit_logs FOR SELECT TO authenticated
  USING (workspace_id IS NULL AND actor_user_id = auth.uid()
         OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid())));

CREATE POLICY "audit insert by self" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() OR actor_user_id IS NULL);

CREATE INDEX audit_logs_workspace_created_idx ON public.audit_logs (workspace_id, created_at DESC);
CREATE INDEX audit_logs_actor_created_idx ON public.audit_logs (actor_user_id, created_at DESC);
CREATE INDEX agents_workspace_idx ON public.agents (workspace_id, created_at DESC);
CREATE INDEX executions_workspace_created_idx ON public.executions (workspace_id, created_at DESC);
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);
