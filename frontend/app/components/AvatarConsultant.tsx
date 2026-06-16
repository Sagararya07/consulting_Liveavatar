"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  LiveAvatarSession,
  SessionEvent,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";
import { getOrCreateUserId } from "../lib/identity";
import {
  identifyUser,
  askQuery,
  endSession,
  getHeygenToken,
  getAvatarPreview,
  getLanguages,
  type LiveAvatarLanguage,
} from "../lib/api";

const AVATAR_ID = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID;
const VOICE_ID = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID;

const FALLBACK_LANGUAGES: LiveAvatarLanguage[] = [
  { language: "Multilingual", code: "multi" },
  { language: "English", code: "en" },
];

export default function AvatarConsultant() {
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

  const userId = useRef<string>("");
  // transcript stores turn pairs for end-of-session summary
  const transcript = useRef<{ role: string; text: string }[]>([]);

  // ── Init user identity, avatar preview, languages ───
  useEffect(() => {
    const id = getOrCreateUserId();
    userId.current = id;
    identifyUser(id).catch(console.error);

    if (AVATAR_ID) {
      getAvatarPreview(AVATAR_ID)
        .then((avatar) => setAvatarPreviewUrl(avatar.preview_url))
        .catch(console.error);
    }

    getLanguages()
      .then(setLanguages)
      .catch(console.error);
  }, []);

  // ── Start avatar session ────────────────────────────
  const startSession = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    setStatus("Requesting session token…");

    let token: string;
    try {
      token = await getHeygenToken(AVATAR_ID, VOICE_ID, selectedLanguage);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || "Failed to get session token");
      setStatus("");
      return;
    }

    setStatus("Starting avatar session…");

    try {
      const session = new LiveAvatarSession(token, {
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
        transcript.current.push({ role: "user", text: spokenText });

        const answer = await askQuery(
          userId.current,
          spokenText,
          selectedLanguage
        );
        transcript.current.push({ role: "assistant", text: answer });

        session.repeat(answer);
        setStatus("Avatar ready. Ask your question.");
      });

      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        setStarted(false);
        setStatus("Session ended.");
      });

      await session.start();
      setIsListening(true);

      // Speak welcome dialogue once fully connected
      session.repeat(
        "Hello, I'm Annie. I help organizations explore AI automation, marketing and sales systems, AI agents, revenue operations, and business growth opportunities. How may I assist you today?"
      );
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || "Failed to start avatar session");
      setStatus("");
      avatarRef.current = null;
    }
  }, [selectedLanguage]);

  // ── Send typed message ──────────────────────────────
  const sendText = useCallback(async () => {
    const text = userInput.trim();
    if (!text || !avatarRef.current) return;

    setUserInput("");
    setStatus("Processing…");
    transcript.current.push({ role: "user", text });

    const answer = await askQuery(userId.current, text, selectedLanguage);
    transcript.current.push({ role: "assistant", text: answer });

    avatarRef.current.repeat(answer);
    setStatus("Avatar ready. Ask your question.");
  }, [userInput, selectedLanguage]);

  // ── End session ─────────────────────────────────────
  const stopSession = useCallback(async () => {
    if (!avatarRef.current) return;

    // Save memory summary
    if (transcript.current.length > 0) {
      const flat = transcript.current
        .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text}`)
        .join("\n");
      await endSession(userId.current, flat).catch(console.error);
    }

    await avatarRef.current.stop();
    avatarRef.current = null;
    setStarted(false);
    setIsListening(false);
    setStatus("Session ended. Your conversation has been saved.");
  }, []);

  // ── Keyboard submit ──────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  return (
    <div style={styles.wrapper}>
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

            {/* Top Right Close Button */}
            <button onClick={() => window.close()} style={styles.closeBtn}>
              ✕
            </button>

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
      </div>

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
  closeBtn: {
    position: "absolute",
    top: "16px",
    right: "16px",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "#121212",
    color: "#d4af37",
    border: "1px solid rgba(212, 175, 55, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
    zIndex: 5,
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
};
