import logging
import os
from pathlib import Path

from anthropic import AsyncAnthropic
from dotenv import load_dotenv
from supabase import Client, create_client

# Load the unified .env from the project root (one level up from /backend)
_root_env = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_root_env)

logger = logging.getLogger(__name__)

HF_API_KEY = os.getenv("HF_API_KEY")
HF_EMBEDDING_MODEL = os.getenv(
    "HF_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")


from typing import Optional

def _supabase_key_looks_valid(key: Optional[str]) -> bool:
    if not key:
        return False
    parts = key.split(".")
    return len(parts) == 3 and "dummy" not in key.lower()


if not _supabase_key_looks_valid(SUPABASE_SERVICE_KEY):
    logger.warning(
        "SUPABASE_SERVICE_KEY is missing or invalid. "
        "Knowledge base and user data will use in-memory fallback. "
        "Set the service_role key from Supabase -> Project Settings -> API."
    )

try:
    anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
except Exception as e:
    logger.error(f"Failed to initialize Anthropic client: {e}")
    anthropic_client = None

try:
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    else:
        supabase = None
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
    supabase = None
