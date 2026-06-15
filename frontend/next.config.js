const path = require("path");
const { loadEnvConfig } = require("@next/env");

// Load the unified .env from the project root (one level up from /frontend)
const rootDir = path.resolve(__dirname, "..");
loadEnvConfig(rootDir);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_HEYGEN_AVATAR_ID: process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID,
    NEXT_PUBLIC_HEYGEN_VOICE_ID: process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};
module.exports = nextConfig;
