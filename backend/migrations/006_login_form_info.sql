-- Migration: Create login_form_info table
-- This table stores the pre-chat form details submitted by the user.

CREATE TABLE IF NOT EXISTS public.login_form_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    phone TEXT,
    company_name TEXT,
    role TEXT,
    industry_type TEXT,
    company_website TEXT,
    location TEXT,
    num_employees TEXT,
    service_requirement TEXT,
    budget_range TEXT,
    expected_timeline TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.login_form_info ENABLE ROW LEVEL SECURITY;

-- Allow users to insert and read their own form submissions
CREATE POLICY "Users can insert their own form info"
    ON public.login_form_info
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own form info"
    ON public.login_form_info
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
