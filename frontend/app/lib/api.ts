export const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")) {
    return "/_/backend";
  }
  return "http://localhost:8000";
};
export const API_URL = getApiUrl();

// ── AUTHENTICATION ──────────────────────────────────────────

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Login failed");
  return data;
}

export async function registerUser(name: string, email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Registration failed");
  return data;
}

export async function getMe(token: string) {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Invalid session");
  return res.json();
}

// ── CONVERSATIONS ───────────────────────────────────────────

export type MeetingSlot = {
  id: string;
  start: string;
  end: string;
  label: string;
  timezone: string;
};

export type UiAction = {
  type: string;
  message?: string;
  timezone?: string;
  slots?: MeetingSlot[];
};

export type QueryResult = {
  answer: string;
  conversation_id: string;
  intent: string;
  lead_score: number;
  stage: string;
  status: string;
  score_delta: number;
  ui_action?: UiAction | null;
};

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export async function askQuery(
  userId: string,
  query: string,
  language = "en",
  conversationId?: string,
  token?: string,
  timezone?: string
): Promise<QueryResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/query/ask`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: userId,
      query,
      language,
      conversation_id: conversationId,
      timezone: timezone || getUserTimezone(),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Error asking query");
  }
  return {
    answer: data.answer,
    conversation_id: data.conversation_id,
    intent: data.intent ?? "rag_answer",
    lead_score: data.lead_score ?? 0,
    stage: data.stage ?? "discover",
    status: data.status ?? "cold",
    score_delta: data.score_delta ?? 0,
    ui_action: data.ui_action ?? null,
  };
}

export async function endSession(conversationId: string, token?: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  await fetch(`${API_URL}/conversations/${conversationId}/end`, {
    method: "POST",
    headers,
  });
}

export async function getConversations(token: string) {
  const res = await fetch(`${API_URL}/conversations/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json();
}

export async function getConversationMessages(conversationId: string, token: string) {
  const res = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}


// ── HEYGEN ──────────────────────────────────────────────────

export type LiveAvatarLanguage = {
  language: string;
  code: string;
};

export type LiveAvatarPreview = {
  id: string;
  name: string;
  preview_url: string;
};

export async function getLanguages(): Promise<LiveAvatarLanguage[]> {
  const res = await fetch(`${API_URL}/heygen/languages`);
  if (!res.ok) throw new Error(`Failed to get languages: ${res.status}`);
  const data = await res.json();
  return data.languages as LiveAvatarLanguage[];
}

export async function getAvatarPreview(avatarId: string): Promise<LiveAvatarPreview> {
  const res = await fetch(`${API_URL}/heygen/avatar/${avatarId}`);
  if (!res.ok) throw new Error(`Failed to get avatar preview: ${res.status}`);
  return res.json() as Promise<LiveAvatarPreview>;
}

export async function getHeygenToken(
  token: string,
  avatarId?: string,
  voiceId?: string,
  language = "en"
): Promise<string> {
  const res = await fetch(`${API_URL}/heygen/token`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}` 
    },
    body: JSON.stringify({ avatar_id: avatarId, voice_id: voiceId, language }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to get HeyGen token: ${res.status} – ${detail}`);
  }
  const data = await res.json();
  return data.token as string;
}

// ── SCHEDULING ──────────────────────────────────────────────

export async function getAvailableSlots(token: string, timezone?: string) {
  const tz = timezone || getUserTimezone();
  const res = await fetch(`${API_URL}/scheduling/slots?timezone=${encodeURIComponent(tz)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch slots");
  return res.json() as Promise<{ timezone: string; slots: MeetingSlot[] }>;
}

export async function bookMeeting(
  token: string,
  payload: {
    conversation_id: string;
    slot_id: string;
    slot_start: string;
    slot_end: string;
    timezone?: string;
    attendee_name?: string;
    attendee_email?: string;
  }
) {
  const res = await fetch(`${API_URL}/scheduling/book`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...payload,
      timezone: payload.timezone || getUserTimezone(),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Booking failed");
  return data as {
    message: string;
    stage: string;
    status: string;
    booking: Record<string, unknown>;
  };
}

// ── SETTINGS ────────────────────────────────────────────────
export async function getSettings() {
  const res = await fetch(`${API_URL}/admin/settings`);
  if (!res.ok) throw new Error("Failed to get settings");
  return res.json();
}

export async function updateSettings(data: any) {
  const res = await fetch(`${API_URL}/admin/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update settings");
  return res.json();
}


