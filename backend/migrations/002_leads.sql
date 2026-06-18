-- Phase 1: Consultant intelligence — leads & conversation state
-- Run in Supabase SQL editor after existing schema

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  conversation_id uuid unique references conversations(id) on delete cascade,
  stage text not null default 'discover',
  score int not null default 0 check (score >= 0 and score <= 100),
  status text not null default 'cold',
  signals jsonb not null default '{}',
  qualified_fields jsonb not null default '{}',
  objections jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists leads_user_id_idx on leads(user_id);
create index if not exists leads_conversation_id_idx on leads(conversation_id);
create index if not exists leads_status_idx on leads(status);

-- Auto-update updated_at on row change
create or replace function update_leads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_updated_at on leads;
create trigger leads_updated_at
  before update on leads
  for each row execute function update_leads_updated_at();
