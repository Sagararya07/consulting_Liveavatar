"""Debug helper to print what the running backend process thinks admin credentials are.

Run (from repo root):
  python backend/debug_admin_env.py

Notes:
- Do not commit secrets; this prints only booleans + usernames.
"""

from services.admin_auth_service import _get_admin_credentials, _get_admin_token_secret

u, p = _get_admin_credentials()
print("ADMIN_USERNAME:", u)
print("ADMIN_PASSWORD set:", bool(p))
print("ADMIN_TOKEN_SECRET set:", bool(_get_admin_token_secret()))

