const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function identifyUser(
  userId: string,
  name?: string,
  email?: string
): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/users/identify?user_id=${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email }),
  });
  return res.json();
}

export async function askQuery(
  userId: string,
  query: string,
  language = "en"
): Promise<string> {
  const res = await fetch(`${API_URL}/query/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, query, language }),
  });
  const data = await res.json();
  return data.answer as string;
}

export async function endSession(
  userId: string,
  conversationText: string
): Promise<void> {
  const params = new URLSearchParams({
    user_id: userId,
    conversation_text: conversationText,
  });
  await fetch(`${API_URL}/query/end-session?${params}`, { method: "POST" });
}

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
  if (!res.ok) {
    throw new Error(`Failed to get languages: ${res.status}`);
  }
  const data = await res.json();
  return data.languages as LiveAvatarLanguage[];
}

export async function getAvatarPreview(
  avatarId: string
): Promise<LiveAvatarPreview> {
  const res = await fetch(`${API_URL}/heygen/avatar/${avatarId}`);
  if (!res.ok) {
    throw new Error(`Failed to get avatar preview: ${res.status}`);
  }
  return res.json() as Promise<LiveAvatarPreview>;
}

export async function getHeygenToken(
  avatarId?: string,
  voiceId?: string,
  language = "en"
): Promise<string> {
  const res = await fetch(`${API_URL}/heygen/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avatar_id: avatarId, voice_id: voiceId, language }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to get HeyGen token: ${res.status} – ${detail}`);
  }
  const data = await res.json();
  return data.token as string;
}

