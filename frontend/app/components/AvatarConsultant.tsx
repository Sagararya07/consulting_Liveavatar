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
  translateIntro,
  initSession,
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

  // Prefetch token and session timer states
  const [heygenTokenState, setHeygenTokenState] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);

  // Booking verification modal state
  const [confirmSlot, setConfirmSlot] = useState<MeetingSlot | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmCompany, setConfirmCompany] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Pre-Chat form state
  const [showPreChatForm, setShowPreChatForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company_name: "",
    role: "",
    industry_type: "",
    company_website: "",
    location: "",
    num_employees: "",
    service_requirement: "",
    budget_range: "",
    expected_timeline: ""
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || user.name || "",
        email: prev.email || user.email || ""
      }));
    }
  }, [user]);

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

  // Prefetch HeyGen token on mount or language switch to minimize connection delay
  useEffect(() => {
    if (!token) return;
    getHeygenToken(token, AVATAR_ID, VOICE_ID, selectedLanguage)
      .then((t) => {
        setHeygenTokenState(t);
      })
      .catch((err) => {
        console.error("Token prefetch failed:", err);
      });
  }, [token, selectedLanguage]);

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

    // Handle oral auto-booking: the backend already booked the slot
    if (result.ui_action?.type === "slot_auto_booked") {
      setAvailableSlots([]);
      setStatus("Meeting booked!");
    } else if (result.ui_action?.type === "propose_oral_booking" && result.ui_action.slot) {
      // Propose oral booking: open confirmation modal
      setConfirmSlot(result.ui_action.slot);
    } else if (result.ui_action?.type === "show_slots" && result.ui_action.slots?.length) {
      setAvailableSlots(result.ui_action.slots);
      setSlotTimezone(result.ui_action.timezone || userTimezone.current);
    } else if (result.intent !== "book_meeting") {
      setAvailableSlots([]);
    }
    return result.answer;
  }, [user]);

  const handleBookSlotClick = useCallback((slot: MeetingSlot) => {
    setConfirmSlot(slot);
  }, []);

  const handleBookSlotConfirm = useCallback(async () => {
    if (!token || !conversationId.current || !confirmSlot || isSubmittingBooking) return;
    setIsSubmittingBooking(true);
    setStatus("Booking your meeting…");

    try {
      const result = await bookMeeting(token, {
        conversation_id: conversationId.current,
        slot_id: confirmSlot.id,
        slot_start: confirmSlot.start,
        slot_end: confirmSlot.end,
        timezone: confirmSlot.timezone || slotTimezone || userTimezone.current,
        attendee_name: formData.name,
        attendee_email: formData.email,
        company_name: formData.company_name,
      });

      setAvailableSlots([]);
      setConfirmSlot(null);
      setLeadState((prev) => prev ? { ...prev, stage: result.stage, status: result.status, intent: "rag_answer" } : prev);
      avatarRef.current?.repeat(result.message);
      setStatus("Meeting booked!");
    } catch (err) {
      console.error(err);
      setStatus("Could not book that slot. Please try again.");
    } finally {
      setIsSubmittingBooking(false);
    }
  }, [token, confirmSlot, slotTimezone, confirmName, confirmEmail, confirmCompany, isSubmittingBooking]);

  const handlePreChatSubmit = async () => {
    if (!token) return;
    setLoading(true);
    setStatus("Initializing session...");
    try {
      const res = await initSession(selectedLanguage, formData as Record<string, string>, token);
      setShowPreChatForm(false);
      await startSession(res.conversation_id);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to initialize session");
      setLoading(false);
      setStatus("");
    }
  };

  // ── Start avatar session ────────────────────────────
  const startSession = useCallback(async (existingConvId?: string) => {
    if (!user || !token) return;
    setLoading(true);
    setErrorMsg("");
    setStatus("Requesting session token…");
    if (existingConvId && typeof existingConvId === "string") {
      conversationId.current = existingConvId;
    } else {
      conversationId.current = ""; // reset for new session
    }
    setLeadState(null);
    setAvailableSlots([]);

    let heygenToken = heygenTokenState;
    if (!heygenToken) {
      try {
        heygenToken = await getHeygenToken(token, AVATAR_ID, VOICE_ID, selectedLanguage);
      } catch (err: any) {
        setLoading(false);
        setErrorMsg(err.message || "Failed to get session token");
        setStatus("");
        return;
      }
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
      if (conversationId.current) {
        try {
          setStatus("Generating personalized intro...");
          const result = await askQuery(
            user.id,
            "Hello, I just submitted the form. Please greet me and confirm my requirements.",
            selectedLanguage,
            conversationId.current,
            token,
            userTimezone.current
          );
          const answer = applyQueryResult(result);
          session.repeat(answer);
          setStatus("Avatar ready. Ask your question.");
        } catch(err) {
          console.error(err);
          session.repeat(`Hello ${user.name}, how may I assist you today?`);
        }
      } else {
        try {
          const settings = await getSettings();
          let intro = settings.avatar_intro || "Hello, I am ready to assist you.";
          // Replace variables (global admin-driven identity)
          const avatarName = settings.avatar_name || "";
          intro = intro.replace("{user_name}", user.name || "friend");
          // If template doesn't include {avatar_name}, this is a no-op
          intro = intro.replace("{avatar_name}", avatarName);

          // Translate the intro if the user selected a non-English language
          if (selectedLanguage && selectedLanguage !== "en" && selectedLanguage !== "multi") {
            intro = await translateIntro(intro, selectedLanguage);
          }

          session.repeat(intro);
        } catch (e) {
          // Fallback if settings fail (no hardcoded avatar name)
          session.repeat(`Hello ${user.name}, how may I assist you today?`);
        }
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

  // Countdown Timer Effect: 5 minutes session limit
  useEffect(() => {
    if (!started) return;
    setTimeLeft(300); // Reset to 300 seconds (5 minutes)

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          stopSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [started, stopSession]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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
        {started && (
          <div style={styles.timerBadge}>
            ⏱️ {formatTime(timeLeft)}
          </div>
        )}
        <button onClick={logout} style={styles.logoutBtn}>Logout</button>
      </div>

      {/* Company Logo representing Cypher Swift */}
      <div style={styles.logoContainer}>
        <img 
          src="/cypher_swift_logo.png" 
          alt="Cypher Swift Logo" 
          style={styles.logoImage} 
        />
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
              <button onClick={() => setShowPreChatForm(true)} style={styles.chatNowBtn}>
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
                  onClick={() => handleBookSlotClick(slot)}
                >
                  {slot.label}
                </button>
              ))}
            </div>
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

      {confirmSlot && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modalContent, maxHeight: '90vh', overflowY: 'auto', width: '90%', maxWidth: '600px'}}>
            <h3 style={styles.modalTitle}>Confirm Booking Details</h3>
            <p style={styles.modalSubtitle}>
              You are booking a meeting for:
              <br />
              <strong>{confirmSlot.label} ({slotTimezone || userTimezone.current})</strong>
            </p>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Name</label>
                <input type="text" style={styles.formInput} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Business Mail</label>
                <input type="email" style={styles.formInput} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Calling/WhatsApp Number</label>
                <input type="text" style={styles.formInput} value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Company Name</label>
                <input type="text" style={styles.formInput} value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Role/Designation</label>
                <input type="text" style={styles.formInput} value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Company Website</label>
                <input type="text" style={styles.formInput} value={formData.company_website} onChange={(e) => setFormData({...formData, company_website: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Location</label>
                <input type="text" style={styles.formInput} value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Number of Employees</label>
                <input type="text" style={styles.formInput} value={formData.num_employees} onChange={(e) => setFormData({...formData, num_employees: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Budget Range</label>
                <input type="text" style={styles.formInput} value={formData.budget_range} onChange={(e) => setFormData({...formData, budget_range: e.target.value})} />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Industry Type</label>
              <select style={styles.formInput} value={formData.industry_type} onChange={(e) => setFormData({...formData, industry_type: e.target.value})}>
                <option value="">Select...</option>
                <option value="AI Agent Development">AI Agent Development</option>
                <option value="AI Automation for Marketing and Sales">AI Automation for Marketing and Sales</option>
                <option value="SaaS Product Development">SaaS Product Development</option>
                <option value="Website / Application Development">Website / Application Development</option>
                <option value="CRM / ERP / LMS Development">CRM / ERP / LMS Development</option>
                <option value="Digital Optimization & Branding">Digital Optimization & Branding</option>
                <option value="Cloud Infrastructure & Maintenance">Cloud Infrastructure & Maintenance</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Service Requirement</label>
              <select style={styles.formInput} value={formData.service_requirement} onChange={(e) => setFormData({...formData, service_requirement: e.target.value})}>
                <option value="">Select...</option>
                <option value="AI Agent Development">AI Agent Development</option>
                <option value="AI Automation for Marketing and Sales">AI Automation for Marketing and Sales</option>
                <option value="SaaS Product Development">SaaS Product Development</option>
                <option value="Website / Application Development">Website / Application Development</option>
                <option value="CRM / ERP / LMS Development">CRM / ERP / LMS Development</option>
                <option value="Digital Optimization & Branding">Digital Optimization & Branding</option>
                <option value="Cloud Infrastructure & Maintenance">Cloud Infrastructure & Maintenance</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Expected Timeline</label>
              <select style={styles.formInput} value={formData.expected_timeline} onChange={(e) => setFormData({...formData, expected_timeline: e.target.value})}>
                <option value="">Select...</option>
                <option value="Immediately">Immediately</option>
                <option value="Within 1 Month">Within 1 Month</option>
                <option value="Within 3 Months">Within 3 Months</option>
                <option value="Planning Stage">Planning Stage</option>
              </select>
            </div>
            
            <div style={styles.modalActions}>
              <button
                onClick={() => setConfirmSlot(null)}
                style={styles.modalCancelBtn}
                disabled={isSubmittingBooking}
              >
                Cancel
              </button>
              <button
                onClick={handleBookSlotConfirm}
                style={styles.modalConfirmBtn}
                disabled={isSubmittingBooking || !formData.name || !formData.email}
              >
                {isSubmittingBooking ? "Booking..." : "Confirm & Book"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreChatForm && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modalContent, maxHeight: '90vh', overflowY: 'auto', width: '90%', maxWidth: '600px'}}>
            <h3 style={styles.modalTitle}>Before we begin...</h3>
            <p style={styles.modalSubtitle}>Please tell us a bit about yourself.</p>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Name</label>
                <input type="text" style={styles.formInput} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Business Mail</label>
                <input type="email" style={styles.formInput} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Calling/WhatsApp Number</label>
                <input type="text" style={styles.formInput} value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Company Name</label>
                <input type="text" style={styles.formInput} value={formData.company_name} onChange={(e) => setFormData({...formData, company_name: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Role/Designation</label>
                <input type="text" style={styles.formInput} value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Company Website</label>
                <input type="text" style={styles.formInput} value={formData.company_website} onChange={(e) => setFormData({...formData, company_website: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Location</label>
                <input type="text" style={styles.formInput} value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Number of Employees</label>
                <input type="text" style={styles.formInput} value={formData.num_employees} onChange={(e) => setFormData({...formData, num_employees: e.target.value})} />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Budget Range</label>
                <input type="text" style={styles.formInput} value={formData.budget_range} onChange={(e) => setFormData({...formData, budget_range: e.target.value})} />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Industry Type</label>
              <select style={styles.formInput} value={formData.industry_type} onChange={(e) => setFormData({...formData, industry_type: e.target.value})}>
                <option value="">Select...</option>
                <option value="AI Agent Development">AI Agent Development</option>
                <option value="AI Automation for Marketing and Sales">AI Automation for Marketing and Sales</option>
                <option value="SaaS Product Development">SaaS Product Development</option>
                <option value="Website / Application Development">Website / Application Development</option>
                <option value="CRM / ERP / LMS Development">CRM / ERP / LMS Development</option>
                <option value="Digital Optimization & Branding">Digital Optimization & Branding</option>
                <option value="Cloud Infrastructure & Maintenance">Cloud Infrastructure & Maintenance</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Service Requirement</label>
              <select style={styles.formInput} value={formData.service_requirement} onChange={(e) => setFormData({...formData, service_requirement: e.target.value})}>
                <option value="">Select...</option>
                <option value="AI Agent Development">AI Agent Development</option>
                <option value="AI Automation for Marketing and Sales">AI Automation for Marketing and Sales</option>
                <option value="SaaS Product Development">SaaS Product Development</option>
                <option value="Website / Application Development">Website / Application Development</option>
                <option value="CRM / ERP / LMS Development">CRM / ERP / LMS Development</option>
                <option value="Digital Optimization & Branding">Digital Optimization & Branding</option>
                <option value="Cloud Infrastructure & Maintenance">Cloud Infrastructure & Maintenance</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Expected Timeline</label>
              <select style={styles.formInput} value={formData.expected_timeline} onChange={(e) => setFormData({...formData, expected_timeline: e.target.value})}>
                <option value="">Select...</option>
                <option value="Immediately">Immediately</option>
                <option value="Within 1 Month">Within 1 Month</option>
                <option value="Within 3 Months">Within 3 Months</option>
                <option value="Planning Stage">Planning Stage</option>
              </select>
            </div>
            
            <div style={styles.modalActions}>
              <button onClick={() => setShowPreChatForm(false)} style={styles.modalCancelBtn} disabled={loading}>
                Cancel
              </button>
              <button onClick={handlePreChatSubmit} style={styles.modalConfirmBtn} disabled={loading}>
                {loading ? "Starting..." : "Start Chat"}
              </button>
            </div>
          </div>
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
  logoContainer: {
    width: "100%",
    maxWidth: 720,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#ffffff",
    padding: "10px",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.5)",
    marginBottom: "0.25rem",
  },
  logoImage: {
    height: "55px",
    width: "auto",
    objectFit: "contain",
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
  timerBadge: {
    background: "rgba(239, 68, 68, 0.2)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    color: "#fca5a5",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "bold",
    fontFamily: "monospace",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#18181b",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "16px",
    padding: "24px",
    width: "90%",
    maxWidth: "400px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: "8px",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: "14px",
    color: "#a1a1aa",
    marginBottom: "20px",
    textAlign: "center",
    lineHeight: "1.5",
  },
  formGroup: {
    marginBottom: "16px",
  },
  formLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: "bold",
    color: "#a1a1aa",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  formInput: {
    width: "100%",
    backgroundColor: "#09090b",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    padding: "10px 12px",
    color: "#ffffff",
    fontSize: "14px",
    outline: "none",
  },
  modalActions: {
    display: "flex",
    gap: "12px",
    marginTop: "24px",
  },
  modalCancelBtn: {
    flex: 1,
    padding: "10px 16px",
    backgroundColor: "transparent",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    color: "#e4e4e7",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  modalConfirmBtn: {
    flex: 1,
    padding: "10px 16px",
    backgroundColor: "#7c3aed",
    border: "none",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
};
