
CREATE OR REPLACE FUNCTION public.shares_workspace_with(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members a
    JOIN public.workspace_members b ON a.workspace_id = b.workspace_id
    WHERE a.user_id = auth.uid() AND b.user_id = _other
  );
$$;

CREATE POLICY "Profiles visible to workspace teammates"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_workspace_with(id));
