"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AvatarConsultant from "./components/AvatarConsultant";
import TextChatWidget from "./components/TextChatWidget";
import { useAuth } from "./lib/AuthContext";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#0f0f0f", color: "#fff" }}>
        Loading session...
      </div>
    );
  }

  return (
    <>
      <AvatarConsultant />
      <TextChatWidget />
    </>
  );
}
