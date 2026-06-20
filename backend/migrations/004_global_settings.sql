-- Phase 4: Permanent global avatar settings
-- Run in Supabase SQL editor after 003_conversation_state_bookings.sql

create table if not exists global_settings (
  id int primary key default 1,
  avatar_name text not null default 'Avatar',
  avatar_intro text not null default '',
  system_prompt text not null default '',
  consultant_playbook text not null default '',
  qualification_questions jsonb not null default '[]'::jsonb,
  escalation_threshold int not null default 75,
  book_meeting_threshold int not null default 60,
  updated_at timestamptz not null default now(),
  updated_by text,
  -- single-row table constraint
  constraint global_settings_singleton check (id = 1)
);

-- Seed from current values if first run; do nothing if a row already exists.
insert into global_settings (
  id, avatar_name, avatar_intro, system_prompt,
  consultant_playbook, qualification_questions,
  escalation_threshold, book_meeting_threshold
)
values (
  1,
  'Avor',
  'Hello {user_name}, I''m {avatar_name}. I help organizations explore AI automation, marketing and sales systems, AI agents, revenue operations, and business growth opportunities. How may I assist you today?',
  'You are Avor, a senior AI consultant avatar for a B2B services firm.
Your job is to help visitors understand our offerings, qualify their needs, and guide warm leads toward booking a strategy call.
Always ground factual claims in the provided knowledge base context.
If the context does not contain the answer, say you don''t have that information and offer to connect them with the team.
Keep answers concise and conversational — they will be spoken aloud by an avatar.',
  '1. DISCOVER: Welcome warmly, answer questions, learn about their business.
2. QUALIFY: Uncover team size, role, budget range, and timeline — one question at a time.
3. ANCHOR: Tie their pain points to relevant solutions from the knowledge base.
4. BOOK: When intent is clear, offer to schedule a 30-minute strategy call.
5. Never be pushy. Mirror the user''s tone. Acknowledge objections before reframing.',
  '[
    "What does your team look like today — roughly how many people?",
    "What''s the biggest bottleneck you''re trying to solve right now?",
    "Do you have a timeline in mind for making a decision?",
    "Are you the decision-maker, or should we loop someone else in?"
  ]'::jsonb,
  75,
  60
)
on conflict (id) do nothing;
