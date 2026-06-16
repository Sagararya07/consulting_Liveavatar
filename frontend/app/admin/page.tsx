"use client";

import { useState } from "react";

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")) {
    return "/_/backend";
  }
  return "http://localhost:8000";
};
const API_URL = getApiUrl();

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const [uploading, setUploading] = useState(false);

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
          ? `✅ ${data.message} (${data.chunks_stored} chunks stored)`
          : `❌ Error: ${data.detail}`
      );
    } catch (e) {
      setResult("❌ Upload failed. Is the backend running?");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>Admin — Knowledge Base</h1>
      <p style={styles.sub}>Upload a PDF or DOCX to add to the knowledge base.</p>

      <div style={styles.card}>
        <input
          type="file"
          accept=".pdf,.docx,.doc"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={styles.fileInput}
        />
        <button
          onClick={upload}
          disabled={!file || uploading}
          style={styles.btn}
        >
          {uploading ? "Uploading…" : "Upload Document"}
        </button>
        {result && <p style={styles.result}>{result}</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    background: "#0f0f0f",
    color: "#fff",
    fontFamily: "sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem",
  },
  title: { fontSize: 24, fontWeight: 600, marginBottom: "0.5rem" },
  sub: { color: "#aaa", marginBottom: "2rem" },
  card: {
    background: "#1a1a1a",
    borderRadius: 12,
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    minWidth: 360,
  },
  fileInput: { color: "#fff" },
  btn: {
    padding: "0.7rem 1.5rem",
    borderRadius: 8,
    border: "none",
    background: "#6c47ff",
    color: "#fff",
    cursor: "pointer",
    fontSize: 15,
  },
  result: { fontSize: 14, marginTop: "0.5rem" },
};
