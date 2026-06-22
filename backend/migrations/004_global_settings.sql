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
Your job is to explicitly follow this flow: 1. Introduce yourself. 2. Explain the procedure and details about the user''s required service. 3. Schedule the meeting by suggesting timings ONCE. 4. Conclude with ''Thank you''.
Always ground factual claims in the provided knowledge base context.
If the context does not contain the answer, say you don''t have that information and offer to connect them with the team.
Keep answers concise and conversational — they will be spoken aloud by an avatar.
CRITICAL: You must ONLY speak for the avatar. NEVER simulate the human''s response. Ask exactly ONE question at a time and wait for the human to answer. CRITICAL AVOID LOOPING: Never repeat a question, an introduction, or meeting timings you have already said. After asking a question, you must STOP and WAIT for the user to reply.',
  '1. INTRODUCTION: Introduce yourself as Avor and mention the problem/service selected on their form. (DO THIS ONLY ONCE)
2. EXPLAIN SERVICE: Explain the procedure and details about the selected service using the knowledge base.
3. BOOK: Suggest meeting timings ONCE. If the user picks a timing, fix it and book immediately. Do not repeat timings.
4. CONCLUSION: After the meeting is scheduled, say ''Thank you, the meeting is booked.'' and end the conversation.
CRITICAL: NEVER repeat a conversational phase you have already completed.',
  '[]'::jsonb,
  75,
  60
)
on conflict (id) do nothing;
