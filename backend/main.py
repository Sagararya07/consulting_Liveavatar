import logging

# Configure logging so we see info/warning/error messages in the terminal
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

import config  # noqa: E402,F401 — must be imported first to load .env
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import admin, users, query, heygen

app = FastAPI(title="LiveAvatar Consulting API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # update for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(users.router)
app.include_router(query.router)
app.include_router(heygen.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/debug-config")
def debug_config():
    import os
    from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, HF_API_KEY
    return {
        "ENV_SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "ENV_SUPABASE_SERVICE_KEY_LEN": len(os.getenv("SUPABASE_SERVICE_KEY", "")),
        "ENV_SUPABASE_SERVICE_KEY_PREFIX": os.getenv("SUPABASE_SERVICE_KEY", "")[:10],
        "CONFIG_SUPABASE_URL": SUPABASE_URL,
        "CONFIG_SUPABASE_SERVICE_KEY_PREFIX": SUPABASE_SERVICE_KEY[:10] if SUPABASE_SERVICE_KEY else None,
        "CONFIG_HF_API_KEY_PREFIX": HF_API_KEY[:10] if HF_API_KEY else None,
    }


@app.get("/debug/knowledge-status")
def knowledge_status():
    """Check how many knowledge chunks exist in the database."""
    from config import supabase
    try:
        res = supabase.table("knowledge_chunks").select("source_file, id", count="exact").execute()
        sources = {}
        for row in (res.data or []):
            src = row.get("source_file", "unknown")
            sources[src] = sources.get(src, 0) + 1
        return {
            "total_chunks": res.count,
            "sources": sources,
            "status": "ok",
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}

