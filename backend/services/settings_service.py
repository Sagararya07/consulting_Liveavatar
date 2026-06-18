import json
import os
from pathlib import Path

# Save settings.json in the backend directory
SETTINGS_FILE = Path(__file__).parent.parent / "settings.json"

DEFAULT_SETTINGS = {
    "avatar_name": "Annie",
    "avatar_intro": "Hello {user_name}, I'm {avatar_name}. I help organizations explore AI automation, marketing and sales systems, AI agents, revenue operations, and business growth opportunities. How may I assist you today?",
    "system_prompt": "You are a helpful, friendly AI avatar consultant.\nAnswer the user's question using only the provided knowledge base context.\nIf the context does not contain the answer, say you don't have that information.\nKeep answers concise and conversational — they will be spoken aloud by an avatar.",
    "consultant_playbook": "",
    "qualification_questions": [],
    "escalation_threshold": 75,
    "book_meeting_threshold": 60,
}

def get_settings():
    if not SETTINGS_FILE.exists():
        return DEFAULT_SETTINGS.copy()
    try:
        with open(SETTINGS_FILE, "r") as f:
            settings = json.load(f)
            # Merge with defaults to ensure all keys exist
            for k, v in DEFAULT_SETTINGS.items():
                if k not in settings:
                    settings[k] = v
            return settings
    except Exception:
        return DEFAULT_SETTINGS.copy()

def update_settings(new_settings: dict):
    settings = get_settings()
    settings.update(new_settings)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=4)
    return settings
