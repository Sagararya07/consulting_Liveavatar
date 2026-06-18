"use client";

import { useState, useEffect, useRef } from "react";
import { getSettings, updateSettings } from "../lib/api";

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")) {
    return "/_/backend";
  }
  return "http://localhost:8000";
};
const API_URL = getApiUrl();

/* ─── Icons (inline SVG for zero-dep) ─── */
const IconUpload = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);
const IconSettings = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);
const IconDoc = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.5}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const IconBack = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
);

type TabType = "knowledge" | "settings";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>("knowledge");

  /* ─── Knowledge Base state ─── */
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── Settings state ─── */
  const [settings, setSettings] = useState({
    avatar_name: "",
    avatar_intro: "",
    system_prompt: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsResult, setSettingsResult] = useState("");

  useEffect(() => {
    getSettings().then(setSettings).catch(console.error);
  }, []);

  /* ─── Upload logic ─── */
  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setResult("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_URL}/admin/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      setResult(
        res.ok
          ? `success:${data.message} (${data.chunks_stored} chunks stored)`
          : `error:${data.detail}`
      );
      if (res.ok) setFile(null);
    } catch (e) {
      setResult("error:Upload failed. Is the backend running?");
    } finally {
      setUploading(false);
    }
  };

  /* ─── Settings logic ─── */
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsResult("");
    try {
      await updateSettings(settings);
      setSettingsResult("success:Settings saved successfully.");
    } catch (e) {
      setSettingsResult("error:Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  /* ─── Drag & drop ─── */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const ext = droppedFile.name.toLowerCase().split(".").pop();
      if (ext === "pdf" || ext === "docx" || ext === "doc") {
        setFile(droppedFile);
      }
    }
  };

  const ResultBadge = ({ msg }: { msg: string }) => {
    if (!msg) return null;
    const isSuccess = msg.startsWith("success:");
    const text = msg.replace(/^(success|error):/, "");
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderRadius: 10,
          background: isSuccess ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
          border: `1px solid ${isSuccess ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
          fontSize: 13,
          color: isSuccess ? "#34d399" : "#f87171",
          marginTop: 8,
        }}
      >
        {isSuccess ? <IconCheck /> : <IconX />}
        {text}
      </div>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .admin-page { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .admin-page * { box-sizing: border-box; }

        .admin-tab { 
          display: flex; align-items: center; gap: 10px;
          padding: 12px 20px; border-radius: 12px;
          border: none; background: transparent; color: #9ca3af;
          font-size: 14px; font-weight: 500; cursor: pointer;
          transition: all 0.25s ease; font-family: inherit;
          width: 100%;
        }
        .admin-tab:hover { background: rgba(255,255,255,0.04); color: #d1d5db; }
        .admin-tab.active {
          background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1));
          color: #a78bfa; border-left: 3px solid #8b5cf6;
        }

        .admin-card {
          background: linear-gradient(145deg, rgba(30,30,45,0.8), rgba(20,20,35,0.9));
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; padding: 28px;
          backdrop-filter: blur(20px);
          transition: all 0.3s ease;
        }
        .admin-card:hover { border-color: rgba(139,92,246,0.15); }

        .admin-input {
          width: 100%; padding: 12px 16px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.08); 
          background: rgba(0,0,0,0.3); color: #e5e7eb;
          font-size: 14px; font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .admin-input:focus {
          border-color: rgba(139,92,246,0.5);
          box-shadow: 0 0 0 3px rgba(139,92,246,0.1);
        }
        .admin-input::placeholder { color: #4b5563; }

        textarea.admin-input { resize: vertical; line-height: 1.6; }

        .admin-btn-primary {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 8px; padding: 12px 28px; border-radius: 12px;
          border: none; font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: inherit;
          background: linear-gradient(135deg, #7c3aed, #6366f1);
          color: #fff; transition: all 0.25s ease;
          box-shadow: 0 4px 14px rgba(124,58,237,0.3);
        }
        .admin-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(124,58,237,0.4);
        }
        .admin-btn-primary:active:not(:disabled) { transform: translateY(0); }
        .admin-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .dropzone {
          border: 2px dashed rgba(255,255,255,0.1);
          border-radius: 14px; padding: 40px 24px;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 12px; cursor: pointer;
          transition: all 0.3s ease;
          background: rgba(0,0,0,0.15);
          min-height: 180px;
        }
        .dropzone:hover, .dropzone.drag-over {
          border-color: rgba(139,92,246,0.4);
          background: rgba(139,92,246,0.04);
        }
        .dropzone.has-file {
          border-color: rgba(52,211,153,0.3);
          background: rgba(52,211,153,0.03);
        }

        .file-chip {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 16px; border-radius: 20px;
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.2);
          color: #c4b5fd; font-size: 13px; font-weight: 500;
        }

        .label-text {
          font-size: 13px; font-weight: 600; color: #9ca3af;
          text-transform: uppercase; letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .label-hint {
          font-size: 12px; color: #6b7280; margin: 2px 0 8px 0;
        }

        .section-heading {
          font-size: 18px; font-weight: 700; color: #f3f4f6;
          margin: 0 0 4px 0; display: flex; align-items: center; gap: 10px;
        }
        .section-sub {
          font-size: 14px; color: #6b7280; margin: 0 0 24px 0;
        }

        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          color: #9ca3af; font-size: 13px; text-decoration: none;
          cursor: pointer; transition: color 0.2s; font-weight: 500;
          border: none; background: none; padding: 0; font-family: inherit;
        }
        .back-link:hover { color: #d1d5db; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.4s ease forwards; }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(124,58,237,0.08); }
          50% { box-shadow: 0 0 40px rgba(124,58,237,0.15); }
        }

        .sidebar-brand {
          display: flex; align-items: center; gap: 12px;
          padding: 4px 0 0 4px; margin-bottom: 32px;
        }
        .brand-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, #7c3aed, #6366f1);
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 16px; color: #fff;
        }
        .brand-text {
          font-size: 16px; font-weight: 700; color: #e5e7eb;
          letter-spacing: -0.02em;
        }
      `}</style>

      <div className="admin-page" style={{
        display: "flex",
        minHeight: "100vh",
        background: "linear-gradient(145deg, #0c0c14 0%, #0f0f1a 40%, #111118 100%)",
        color: "#e5e7eb",
      }}>

        {/* ─── Sidebar ─── */}
        <aside style={{
          width: 260,
          padding: "28px 20px",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          flexDirection: "column",
          background: "rgba(0,0,0,0.2)",
          flexShrink: 0,
        }}>
          <div className="sidebar-brand">
            <div className="brand-icon">LA</div>
            <div className="brand-text">LiveAvatar</div>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button
              className={`admin-tab ${activeTab === "knowledge" ? "active" : ""}`}
              onClick={() => setActiveTab("knowledge")}
            >
              <IconUpload /> Knowledge Base
            </button>
            <button
              className={`admin-tab ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <IconSettings /> Avatar Settings
            </button>
          </nav>

          <div style={{ flex: 1 }} />

          <a href="/" className="back-link">
            <IconBack /> Back to App
          </a>
        </aside>

        {/* ─── Main Content ─── */}
        <main style={{
          flex: 1,
          padding: "40px 48px",
          maxWidth: 800,
          overflowY: "auto",
        }}>

          {/* ── Knowledge Base Tab ── */}
          {activeTab === "knowledge" && (
            <div className="fade-in">
              <h1 className="section-heading">
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <IconUpload />
                </span>
                Knowledge Base
              </h1>
              <p className="section-sub">
                Upload PDF or DOCX documents to train your avatar's knowledge.
              </p>

              <div className="admin-card">
                {/* Drop zone */}
                <div
                  className={`dropzone ${dragOver ? "drag-over" : ""} ${file ? "has-file" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc"
                    style={{ display: "none" }}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file ? (
                    <>
                      <div className="file-chip">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        {file.name}
                      </div>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        {(file.size / 1024).toFixed(1)} KB — Click to change
                      </span>
                    </>
                  ) : (
                    <>
                      <IconDoc />
                      <span style={{ fontSize: 14, color: "#9ca3af", fontWeight: 500 }}>
                        Drag & drop your file here
                      </span>
                      <span style={{ fontSize: 12, color: "#4b5563" }}>
                        or click to browse  ·  PDF, DOCX supported
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button
                    className="admin-btn-primary"
                    onClick={upload}
                    disabled={!file || uploading}
                  >
                    {uploading ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        Uploading…
                      </>
                    ) : (
                      <>
                        <IconUpload />
                        Upload & Process
                      </>
                    )}
                  </button>
                </div>

                <ResultBadge msg={result} />
              </div>
            </div>
          )}

          {/* ── Settings Tab ── */}
          {activeTab === "settings" && (
            <div className="fade-in">
              <h1 className="section-heading">
                <span style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <IconSettings />
                </span>
                Avatar Settings
              </h1>
              <p className="section-sub">
                Customize your avatar's identity, greeting, and persona.
              </p>

              <div className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Avatar Name */}
                <div>
                  <div className="label-text">Avatar Name</div>
                  <input
                    className="admin-input"
                    value={settings.avatar_name}
                    onChange={(e) => setSettings({ ...settings, avatar_name: e.target.value })}
                    placeholder="e.g. Annie"
                  />
                </div>

                {/* Intro Message */}
                <div>
                  <div className="label-text">Intro Message</div>
                  <div className="label-hint">
                    Template variables: <code style={{ color: "#a78bfa", background: "rgba(139,92,246,0.1)", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>{"{user_name}"}</code>{" "}
                    <code style={{ color: "#a78bfa", background: "rgba(139,92,246,0.1)", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>{"{avatar_name}"}</code>
                  </div>
                  <textarea
                    className="admin-input"
                    rows={4}
                    value={settings.avatar_intro}
                    onChange={(e) => setSettings({ ...settings, avatar_intro: e.target.value })}
                    placeholder="Hello {user_name}, I'm {avatar_name}..."
                  />
                </div>

                {/* System Prompt */}
                <div>
                  <div className="label-text">System Prompt</div>
                  <div className="label-hint">
                    This defines the avatar's LLM persona and behavior.
                  </div>
                  <textarea
                    className="admin-input"
                    rows={6}
                    value={settings.system_prompt}
                    onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
                    placeholder="You are a helpful, friendly AI avatar consultant..."
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 4 }}>
                  <button
                    className="admin-btn-primary"
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                  >
                    {savingSettings ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        Saving…
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Save Settings
                      </>
                    )}
                  </button>
                </div>

                <ResultBadge msg={settingsResult} />
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
