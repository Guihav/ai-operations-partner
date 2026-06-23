
create extension if not exists vector;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles select own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, company_name)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'company_name');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- agents
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  objective text not null,
  schedule text not null default 'manual',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.agents to authenticated;
grant all on public.agents to service_role;
alter table public.agents enable row level security;
create policy "agents owner all" on public.agents for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- agent_documents
create table public.agent_documents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  mime_type text,
  size_bytes int,
  status text not null default 'processing',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.agent_documents to authenticated;
grant all on public.agent_documents to service_role;
alter table public.agent_documents enable row level security;
create policy "agent_documents owner all" on public.agent_documents for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- document chunks with embeddings
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.agent_documents(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  chunk_index int not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.document_chunks to authenticated;
grant all on public.document_chunks to service_role;
alter table public.document_chunks enable row level security;
create policy "document_chunks owner all" on public.document_chunks for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create index document_chunks_embedding_idx on public.document_chunks using hnsw (embedding vector_cosine_ops);

-- conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "conversations owner all" on public.conversations for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "messages owner all" on public.messages for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- executions (task runs)
create table public.executions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  response text,
  status text not null default 'completed',
  hours_saved numeric not null default 0.5,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.executions to authenticated;
grant all on public.executions to service_role;
alter table public.executions enable row level security;
create policy "executions owner all" on public.executions for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- vector search function (scoped to owner via auth.uid())
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_agent_id uuid,
  match_count int default 5
) returns table (id uuid, content text, similarity float)
language sql stable security definer set search_path = public as $$
  select c.id, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  where c.agent_id = match_agent_id
    and c.owner_id = auth.uid()
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
grant execute on function public.match_document_chunks(vector, uuid, int) to authenticated;
