"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerUser } from "../lib/api";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await registerUser(name, email, password);
      // After registration, redirect to login
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "Failed to register");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Create Account</h1>
        <p style={styles.subtitle}>Sign up for LiveAvatar</p>
        
        {error && <div style={styles.error}>{error}</div>}
        
        <form onSubmit={handleRegister} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
              minLength={8}
            />
          </div>
          <button type="submit" disabled={isLoading} style={styles.button}>
            {isLoading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{" "}
          <span style={styles.link} onClick={() => router.push("/login")}>
            Sign in here
          </span>
        </p>
      </div>
    </div>
  );
}

// Reuse the exact same styles from login page
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#0f0f0f",
    color: "#fff",
    fontFamily: "sans-serif",
  },
  card: {
    backgroundColor: "#1a1a2e",
    padding: "3rem",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "400px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    border: "1px solid rgba(108, 71, 255, 0.15)",
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.75rem",
    fontWeight: "bold",
    textAlign: "center",
  },
  subtitle: {
    margin: "0 0 2rem 0",
    color: "#aaa",
    textAlign: "center",
    fontSize: "0.95rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  label: {
    fontSize: "0.9rem",
    color: "#ccc",
  },
  input: {
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    border: "1px solid #333",
    backgroundColor: "#111",
    color: "#fff",
    fontSize: "1rem",
    outline: "none",
  },
  button: {
    padding: "0.75rem",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#6c47ff",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "0.5rem",
    transition: "opacity 0.2s",
  },
  error: {
    padding: "0.75rem",
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    border: "1px solid rgba(255, 107, 107, 0.3)",
    color: "#ff6b6b",
    borderRadius: "8px",
    marginBottom: "1.5rem",
    fontSize: "0.9rem",
    textAlign: "center",
  },
  footer: {
    marginTop: "2rem",
    textAlign: "center",
    fontSize: "0.9rem",
    color: "#888",
  },
  link: {
    color: "#6c47ff",
    cursor: "pointer",
    textDecoration: "underline",
  },
};
