-- Run this entire file in your Supabase SQL editor

-- Enable pgvector extension
create extension if not exists vector;

-- ── Users ──────────────────────────────────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  created_at timestamptz default now()
);

-- ── Conversation summaries ─────────────────────────────
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  summary text not null,
  created_at timestamptz default now()
);
create index if not exists conversations_user_id_idx on conversations(user_id);

-- ── Knowledge chunks ───────────────────────────────────
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536),
  source_file text,
  created_at timestamptz default now()
);

-- Similarity search function (cosine distance)
create or replace function match_chunks(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  source_file text,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    source_file,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_chunks
  order by embedding <=> query_embedding
  limit match_count;
$$;
