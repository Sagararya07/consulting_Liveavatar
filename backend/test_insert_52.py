import os
from config import supabase
import uuid

rows = []
for i in range(52):
    rows.append({
        "content": f"Test chunk {i}",
        "embedding": [0.1] * 1536,
        "source_file": "AVOR_simulated.docx"
    })

try:
    res = supabase.table("knowledge_chunks").insert(rows).execute()
    print("Success:", len(res.data))
except Exception as e:
    print(f"Error: {e}")
