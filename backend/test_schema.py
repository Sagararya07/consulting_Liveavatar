import logging
logging.basicConfig(level=logging.WARNING)
from config import supabase

try:
    res = supabase.rpc("get_table_schema", {"table_name": "knowledge_chunks"}).execute()
    print("Schema:", res)
except Exception as e:
    print("Error getting schema via RPC:", e)

    # Let's just try to insert one mock row to see what the error is when inserting something large.
    # Actually we did that and it succeeded!
