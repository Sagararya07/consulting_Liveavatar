import os
from config import supabase
try:
    res = supabase.table("knowledge_chunks").select("*").limit(1).execute()
    if res.data:
        print("Keys:", res.data[0].keys())
        print("Embedding len:", len(res.data[0]['embedding']))
    else:
        print("No data")
except Exception as e:
    print(f"Error: {e}")
