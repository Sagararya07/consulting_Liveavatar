-- Phase 2: Structured conversation state
-- Run in Supabase SQL editor after 002_leads.sql

create table if not exists conversation_state (
  conversation_id uuid primary key references conversations(id) on delete cascade,
  turn_count int not null default 0,
  questions_asked jsonb not null default '[]',
  topics_discussed jsonb not null default '[]',
  stage_history jsonb not null default '[]',
  last_intent text,
  updated_at timestamptz default now()
);

create index if not exists conversation_state_updated_idx on conversation_state(updated_at);

-- Phase 3: Meeting bookings
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  timezone text not null default 'UTC',
  attendee_email text,
  attendee_name text,
  external_booking_id text,
  status text not null default 'confirmed',
  created_at timestamptz default now()
);

create index if not exists bookings_conversation_id_idx on bookings(conversation_id);
create index if not exists bookings_user_id_idx on bookings(user_id);
