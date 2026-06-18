"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  LiveAvatarSession,
  SessionEvent,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";
import { useAuth } from "../lib/AuthContext";
import {
  askQuery,
  bookMeeting,
  endSession,
  getHeygenToken,
  getAvatarPreview,
  getLanguages,
  getSettings,
  getUserTimezone,
  type LiveAvatarLanguage,
  type MeetingSlot,
  type QueryResult,
} from "../lib/api";

const AVATAR_ID = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID;
const VOICE_ID = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID;

const FALLBACK_LANGUAGES: LiveAvatarLanguage[] = [
  { language: "Multilingual", code: "multi" },
  { language: "English", code: "en" },
];

export default function AvatarConsultant() {
  const { user, token, logout } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarRef = useRef<LiveAvatarSession | null>(null);

  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [status, setStatus] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [languages, setLanguages] = useState<LiveAvatarLanguage[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("multi");
  const [leadState, setLeadState] = useState<Pick<QueryResult, "intent" | "lead_score" | "stage" | "status" | "score_delta"> | null>(null);
  const [availableSlots, setAvailableSlots] = useState<MeetingSlot[]>([]);
  const [slotTimezone, setSlotTimezone] = useState("");
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);

  const userTimezone = useRef(getUserTimezone());

  // Keep track of conversation ID returned from the backend
  const conversationId = useRef<string>("");

  // ── Init avatar preview, languages ───
  useEffect(() => {
    if (AVATAR_ID) {
      getAvatarPreview(AVATAR_ID)
        .then((avatar) => setAvatarPreviewUrl(avatar.preview_url))
        .catch(console.error);
    }

    getLanguages()
      .then(setLanguages)
      .catch(console.error);
  }, []);

  // ── Apply consultant turn result to UI state ────────
  const applyQueryResult = useCallback((result: QueryResult) => {
    if (result.conversation_id) conversationId.current = result.conversation_id;
    setLeadState({
      intent: result.intent,
      lead_score: result.lead_score,
      stage: result.stage,
      status: result.status,
      score_delta: result.score_delta,
    });
    if (result.ui_action?.type === "show_slots" && result.ui_action.slots?.length) {
      setAvailableSlots(result.ui_action.slots);
      setSlotTimezone(result.ui_action.timezone || userTimezone.current);
    } else if (result.intent !== "book_meeting") {
      setAvailableSlots([]);
    }
    return result.answer;
  }, []);

  const handleBookSlot = useCallback(async (slot: MeetingSlot) => {
    if (!token || !conversationId.current || bookingSlotId) return;
    setBookingSlotId(slot.id);
    setStatus("Booking your meeting…");

    try {
      const result = await bookMeeting(token, {
        conversation_id: conversationId.current,
        slot_id: slot.id,
        slot_start: slot.start,
        slot_end: slot.end,
        timezone: slot.timezone || slotTimezone || userTimezone.current,
        attendee_name: user?.name,
        attendee_email: user?.email,
      });

      setAvailableSlots([]);
      setLeadState((prev) => prev ? { ...prev, stage: result.stage, status: result.status, intent: "rag_answer" } : prev);
      avatarRef.current?.repeat(result.message);
      setStatus("Meeting booked!");
    } catch (err) {
      console.error(err);
      setStatus("Could not book that slot. Please try another.");
    } finally {
      setBookingSlotId(null);
    }
  }, [token, user, slotTimezone, bookingSlotId]);

  // ── Start avatar session ────────────────────────────
  const startSession = useCallback(async () => {
    if (!user || !token) return;
    setLoading(true);
    setErrorMsg("");
    setStatus("Requesting session token…");
    conversationId.current = ""; // reset for new session
    setLeadState(null);
    setAvailableSlots([]);

    let heygenToken: string;
    try {
      heygenToken = await getHeygenToken(token, AVATAR_ID, VOICE_ID, selectedLanguage);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || "Failed to get session token");
      setStatus("");
      return;
    }

    setStatus("Starting avatar session…");

    try {
      const session = new LiveAvatarSession(heygenToken, {
        voiceChat: true,
      });
      avatarRef.current = session;

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (videoRef.current) {
          session.attach(videoRef.current);
          videoRef.current.play().catch(console.error);
        }
        setStarted(true);
        setLoading(false);
        setStatus("Avatar ready. Ask your question.");
      });

      session.on(AgentEventsEnum.USER_TRANSCRIPTION, async (event) => {
        const spokenText = event.text || "";
        if (!spokenText.trim()) return;

        setStatus("Processing…");

        try {
          const result = await askQuery(
            user.id,
            spokenText,
            selectedLanguage,
            conversationId.current || undefined,
            token,
            userTimezone.current
          );
          const answer = applyQueryResult(result);

          session.repeat(answer);
          setStatus("Avatar ready. Ask your question.");
        } catch (err) {
          console.error(err);
          setStatus("Error getting response.");
        }
      });

      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        setStarted(false);
        setStatus("Session ended.");
      });

      await session.start();
      setIsListening(true);

      // Speak welcome dialogue once fully connected
      try {
        const settings = await getSettings();
        let intro = settings.avatar_intro || "Hello, I am ready to assist you.";
        // Replace variables
        intro = intro.replace("{user_name}", user.name || "friend");
        intro = intro.replace("{avatar_name}", settings.avatar_name || "Annie");
        session.repeat(intro);
      } catch (e) {
        // Fallback if settings fail
        session.repeat(`Hello ${user.name}, how may I assist you today?`);
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || "Failed to start avatar session");
      setStatus("");
      avatarRef.current = null;
    }
  }, [selectedLanguage, user, token, applyQueryResult]);

  // ── Send typed message ──────────────────────────────
  const sendText = useCallback(async () => {
    const text = userInput.trim();
    if (!text || !avatarRef.current || !user || !token) return;

    setUserInput("");
    setStatus("Processing…");

    try {
      const result = await askQuery(
        user.id,
        text,
        selectedLanguage,
        conversationId.current || undefined,
        token,
        userTimezone.current
      );
      const answer = applyQueryResult(result);

      avatarRef.current.repeat(answer);
      setStatus("Avatar ready. Ask your question.");
    } catch (err) {
      console.error(err);
      setStatus("Error getting response.");
    }
  }, [userInput, selectedLanguage, user, token, applyQueryResult]);

  // ── End session ─────────────────────────────────────
  const stopSession = useCallback(async () => {
    if (!avatarRef.current || !token) return;

    // Save memory summary if we have a conversation ID
    if (conversationId.current) {
      await endSession(conversationId.current, token).catch(console.error);
    }

    await avatarRef.current.stop();
    avatarRef.current = null;
    setStarted(false);
    setIsListening(false);
    setStatus("Session ended. Your conversation has been saved.");
  }, [token]);

  // ── Keyboard submit ──────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* Top Header / Profile */}
      <div style={styles.header}>
        <div style={styles.userInfo}>
          <div style={styles.avatarCircle}>{user?.name?.[0]?.toUpperCase()}</div>
          <span style={styles.userName}>{user?.name}</span>
        </div>
        <button onClick={logout} style={styles.logoutBtn}>Logout</button>
      </div>

      <div style={styles.videoBox}>
        <video ref={videoRef} autoPlay playsInline style={styles.video} />
        
        {/* Avatar preview image shown before session starts */}
        {!started && !loading && (
          <>
            {avatarPreviewUrl && (
              <img
                src={avatarPreviewUrl}
                alt="Avatar Preview"
                style={styles.backgroundImage}
              />
            )}

            {/* Bottom floating control card */}
            <div style={styles.floatingCard}>
              <div style={styles.selectWrapper}>
                <select
                  style={styles.languageSelect}
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                >
                  {(languages.length ? languages : FALLBACK_LANGUAGES).map(
                    (lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.language}
                      </option>
                    )
                  )}
                </select>
                <span style={styles.chevron}>▼</span>
              </div>
              <button onClick={startSession} style={styles.chatNowBtn}>
                Chat now
              </button>
            </div>

            {errorMsg && (
              <div style={styles.errorOverlay}>
                <p style={styles.errorText}>{errorMsg}</p>
              </div>
            )}
          </>
        )}

        {/* Loading state */}
        {!started && loading && (
          <div style={styles.placeholder}>
            <div style={styles.spinner} />
            <p style={styles.statusText}>{status}</p>
          </div>
        )}

        {started && availableSlots.length > 0 && (
          <div style={styles.slotOverlay}>
            <p style={styles.slotTitle}>Pick a time ({slotTimezone || userTimezone.current})</p>
            <div style={styles.slotList}>
              {availableSlots.map((slot) => (
                <button
                  key={slot.id}
                  style={styles.slotBtn}
                  disabled={bookingSlotId === slot.id}
                  onClick={() => handleBookSlot(slot)}
                >
                  {bookingSlotId === slot.id ? "Booking…" : slot.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {started && leadState && (
        <div style={styles.leadPanel}>
          <span style={styles.leadLabel}>Consultant</span>
          <span style={styles.leadChip}>{leadState.stage}</span>
          <span style={{
            ...styles.leadChip,
            color: leadState.status === "hot" ? "#ff9f43" : leadState.status === "warm" ? "#ffd166" : "#aaa",
          }}>
            {leadState.status} · {leadState.lead_score}
          </span>
          <span style={styles.leadChip}>{leadState.intent.replace("_", " ")}</span>
          {leadState.score_delta > 0 && (
            <span style={styles.leadDelta}>+{leadState.score_delta}</span>
          )}
        </div>
      )}

      {started && (
        <div style={styles.controls}>
          <p style={styles.statusText}>{status}</p>
          {isListening && (
            <p style={styles.listenBadge}>🎙 Listening — speak anytime</p>
          )}
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Or type your question…"
            />
            <button onClick={sendText} style={styles.sendBtn}>
              Send
            </button>
          </div>
          <button onClick={stopSession} style={styles.stopBtn}>
            End Session
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.5rem",
    padding: "2rem",
    fontFamily: "sans-serif",
    minHeight: "100vh",
    background: "#0f0f0f",
    color: "#fff",
  },
  header: {
    width: "100%",
    maxWidth: 720,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  avatarCircle: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6c47ff, #b647ff)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.2rem",
    fontWeight: "bold",
    color: "#fff",
  },
  userName: {
    fontSize: "1rem",
    fontWeight: 500,
  },
  logoutBtn: {
    background: "transparent",
    border: "1px solid #444",
    color: "#ccc",
    padding: "6px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.85rem",
    transition: "background 0.2s",
  },
  videoBox: {
    position: "relative",
    width: "100%",
    maxWidth: 720,
    aspectRatio: "16/9",
    background: "linear-gradient(145deg, #1a1a2e, #16162a)",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(108, 71, 255, 0.15)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  video: { width: "100%", height: "100%", objectFit: "cover" },
  placeholder: {
    position: "absolute",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
  },
  backgroundImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  floatingCard: {
    position: "absolute",
    bottom: "24px",
    background: "#ffffff",
    borderRadius: "20px",
    padding: "8px 8px 8px 16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    zIndex: 5,
  },
  selectWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  languageSelect: {
    appearance: "none",
    background: "transparent",
    border: "none",
    color: "#111111",
    fontSize: "15px",
    fontWeight: 500,
    paddingRight: "24px",
    cursor: "pointer",
    outline: "none",
    fontFamily: "inherit",
  },
  chevron: {
    position: "absolute",
    right: "4px",
    color: "#555555",
    fontSize: "9px",
    pointerEvents: "none",
  },
  chatNowBtn: {
    background: "#00bfff",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    padding: "10px 24px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s, transform 0.1s",
  },
  errorOverlay: {
    position: "absolute",
    top: "30px",
    width: "100%",
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 10,
  },
  errorText: {
    margin: 0,
    fontSize: 13,
    color: "#ff6b6b",
    background: "rgba(0, 0, 0, 0.8)",
    padding: "0.5rem 1rem",
    borderRadius: 8,
    border: "1px solid rgba(255, 107, 107, 0.3)",
    maxWidth: 400,
    textAlign: "center",
    pointerEvents: "auto",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid rgba(108, 71, 255, 0.2)",
    borderTop: "3px solid #6c47ff",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  controls: {
    width: "100%",
    maxWidth: 720,
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  statusText: { margin: 0, fontSize: 14, color: "#aaa" },
  listenBadge: {
    margin: 0,
    fontSize: 13,
    color: "#7effa0",
    fontWeight: 500,
  },
  inputRow: { display: "flex", gap: "0.5rem" },
  input: {
    flex: 1,
    padding: "0.6rem 1rem",
    borderRadius: 8,
    border: "1px solid #333",
    background: "#1a1a1a",
    color: "#fff",
    fontSize: 15,
  },
  sendBtn: {
    padding: "0.6rem 1.2rem",
    borderRadius: 8,
    border: "none",
    background: "#6c47ff",
    color: "#fff",
    cursor: "pointer",
    fontSize: 15,
  },
  stopBtn: {
    padding: "0.5rem 1rem",
    borderRadius: 8,
    border: "1px solid #555",
    background: "transparent",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 13,
    alignSelf: "flex-start",
  },
  leadPanel: {
    width: "100%",
    maxWidth: 720,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    background: "rgba(108, 71, 255, 0.08)",
    border: "1px solid rgba(108, 71, 255, 0.2)",
    borderRadius: 10,
    fontSize: 12,
  },
  leadLabel: {
    color: "#888",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginRight: 4,
  },
  leadChip: {
    background: "rgba(255,255,255,0.06)",
    padding: "3px 10px",
    borderRadius: 6,
    color: "#ccc",
    textTransform: "capitalize",
  },
  leadDelta: {
    color: "#7effa0",
    fontWeight: 600,
    marginLeft: "auto",
  },
  slotOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "linear-gradient(transparent, rgba(0,0,0,0.92) 30%)",
    padding: "24px 16px 16px",
    zIndex: 8,
  },
  slotTitle: {
    margin: "0 0 10px",
    fontSize: 13,
    color: "#ccc",
    textAlign: "center",
  },
  slotList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  slotBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(108, 71, 255, 0.4)",
    background: "rgba(108, 71, 255, 0.25)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
};
