
-- Switch match function to security invoker so RLS applies as the calling user
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_agent_id uuid,
  match_count int default 5
) returns table (id uuid, content text, similarity float)
language sql stable security invoker set search_path = public as $$
  select c.id, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  where c.agent_id = match_agent_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Trigger function for new user — keep security definer (must insert into profiles)
-- but lock down execution; only the trigger context calls it.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Storage policies for agent-documents bucket: scope by first folder = user id
create policy "agent-documents read own"
on storage.objects for select to authenticated
using (bucket_id = 'agent-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "agent-documents insert own"
on storage.objects for insert to authenticated
with check (bucket_id = 'agent-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "agent-documents delete own"
on storage.objects for delete to authenticated
using (bucket_id = 'agent-documents' and (storage.foldername(name))[1] = auth.uid()::text);
