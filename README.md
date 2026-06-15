# LiveAvatar Consulting — Setup Guide

A full-stack AI consulting avatar using HeyGen Streaming Avatar, Claude (Anthropic),
RAG on Supabase pgvector, and a Next.js frontend backed by FastAPI.

---

## Architecture overview

```
User (voice / text)
  └─► HeyGen Streaming Avatar (frontend)
        └─► FastAPI backend
              ├─► Hugging Face Embeddings → Supabase (pgvector) similarity search
              ├─► Anthropic Claude   → generates answer using retrieved chunks
              └─► User memory        → Supabase conversations table (session summaries)
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| Supabase account | free tier works |
| Hugging Face API key | for embeddings (free tier) |
| Anthropic API key | for Claude |
| HeyGen API key | for streaming avatar |

---

## Step 1 — Supabase setup

1. Create a new Supabase project at https://supabase.com
2. In the Supabase dashboard go to **SQL Editor**
3. Paste and run the entire contents of `backend/schema.sql`

This creates:
- `users` table
- `conversations` table (session summaries)
- `knowledge_chunks` table with pgvector column
- `match_chunks` RPC function for similarity search

---

## Step 2 — Backend setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Fill in .env with your keys:
#   HF_API_KEY
#   ANTHROPIC_API_KEY
#   SUPABASE_URL          (from Supabase project settings → API)
#   SUPABASE_SERVICE_KEY  (service_role key, NOT anon key)

# Start the server
uvicorn main:app --reload --port 8000
```

The API is now available at http://localhost:8000
Interactive docs: http://localhost:8000/docs

---

## Step 3 — Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Fill in .env.local:
#   NEXT_PUBLIC_HEYGEN_API_KEY     — your HeyGen API key
#   NEXT_PUBLIC_HEYGEN_AVATAR_ID   — avatar ID from HeyGen studio
#   NEXT_PUBLIC_HEYGEN_VOICE_ID    — voice ID from HeyGen studio
#   NEXT_PUBLIC_API_URL            — http://localhost:8000

# Start the dev server
npm run dev
```

Frontend is at http://localhost:3000

---

## Step 4 — Upload your knowledge base

1. Open http://localhost:3000/admin
2. Upload a PDF or DOCX file
3. The backend will parse, chunk, embed, and store it in Supabase
4. Repeat for as many documents as you need

---

## Step 5 — Test the avatar

1. Open http://localhost:3000
2. Click **Start Consultation**
3. The HeyGen avatar will appear and start listening
4. Speak your question — HeyGen handles mic input and STT
5. The avatar will answer using your knowledge base
6. You can also type in the input box and press Enter or Send
7. Click **End Session** — this saves a summary of the conversation
8. On your next visit the avatar will remember previous topics

---

## Project structure

```
liveavatar/
├── backend/
│   ├── main.py                      ← FastAPI app entry point
│   ├── config.py                    ← API clients (OpenAI, Anthropic, Supabase)
│   ├── schema.sql                   ← Run this in Supabase SQL editor
│   ├── requirements.txt
│   ├── .env.example
│   ├── models/
│   │   └── schemas.py               ← Pydantic request/response models
│   ├── routers/
│   │   ├── admin.py                 ← POST /admin/upload
│   │   ├── users.py                 ← POST /users/identify
│   │   └── query.py                 ← POST /query/ask, POST /query/end-session
│   ├── services/
│   │   ├── embedding_service.py     ← Hugging Face all-MiniLM-L6-v2
│   │   ├── ingestion_service.py     ← Chunk + embed + store document
│   │   ├── query_service.py         ← RAG search + Claude answer
│   │   └── memory_service.py        ← User identity + session summaries
│   └── utils/
│       └── document_parser.py       ← PDF and DOCX text extraction
│
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx                 ← Main avatar page
    │   ├── admin/page.tsx           ← Document upload page
    │   ├── components/
    │   │   └── AvatarConsultant.tsx ← HeyGen streaming avatar component
    │   └── lib/
    │       ├── api.ts               ← FastAPI client functions
    │       └── identity.ts          ← localStorage user ID management
    ├── package.json
    ├── next.config.js
    ├── tsconfig.json
    └── .env.example
```

---

## How user memory works

1. On first visit a UUID is generated and saved to `localStorage`
2. FastAPI checks if that UUID exists in the `users` table — creates it if not
3. For returning users, the latest conversation summary is fetched and injected
   into Claude's system prompt so it knows the user's history
4. When the user clicks "End Session", the full conversation transcript is sent
   to Claude which summarises it in 3–5 sentences and stores it in `conversations`

---

## Multi-language support

The `language` field in `POST /query/ask` accepts any ISO 639-1 code (e.g. `"hi"`, `"ar"`, `"fr"`).
Claude will respond in that language. To auto-detect the user's browser language,
add this to `AvatarConsultant.tsx`:

```ts
const lang = navigator.language.split("-")[0]; // e.g. "hi", "fr"
const answer = await askQuery(userId.current, text, lang);
```

---

## Deploying to production

- **Backend**: Deploy to Railway, Render, or any Python host. Update `CORS` origins in `main.py`
- **Frontend**: Deploy to Vercel (`vercel deploy`). Set all `NEXT_PUBLIC_*` env vars in Vercel dashboard
- **Supabase**: Already hosted — just update `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
