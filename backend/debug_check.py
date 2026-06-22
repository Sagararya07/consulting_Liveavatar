"""Debug script to check data in knowledge_chunks and test match_chunks RPC."""
from config import supabase

# 1. Check total row count
res = supabase.table("knowledge_chunks").select("id", count="exact").execute()
print(f"Total rows in knowledge_chunks: {res.count}")

# 2. Check a sample of rows - look at embedding format
res = supabase.table("knowledge_chunks").select("id, content, source_file, embedding").limit(3).execute()
if res.data:
    for row in res.data:
        emb = row.get("embedding")
        emb_info = "None"
        if emb is not None:
            if isinstance(emb, str):
                emb_info = f"STRING, len={len(emb)}, preview={emb[:80]}"
            elif isinstance(emb, list):
                emb_info = f"LIST, len={len(emb)}, first_3={emb[:3]}"
            else:
                emb_info = f"TYPE={type(emb).__name__}"
        print(f"  id={row['id']}")
        print(f"  content={row['content'][:60]}")
        print(f"  source_file={row['source_file']}")
        print(f"  embedding={emb_info}")
        print()
else:
    print("No data found!")

# 3. Test the match_chunks RPC with a dummy embedding
print("--- Testing match_chunks RPC ---")
try:
    rpc_res = supabase.rpc(
        "match_chunks",
        {"query_embedding": [0.1] * 1536, "match_count": 5}
    ).execute()
    print(f"RPC returned {len(rpc_res.data) if rpc_res.data else 0} results")
    if rpc_res.data:
        for r in rpc_res.data:
            print(f"  id={r['id']}, similarity={r['similarity']}, content={r['content'][:50]}")
except Exception as e:
    print(f"RPC ERROR: {e}")

# 4. Check distinct source files
res = supabase.table("knowledge_chunks").select("source_file").execute()
if res.data:
    sources = set(r["source_file"] for r in res.data)
    print(f"\nDistinct source files: {sources}")

# 5. Check if the embedding column has the right data for AVOR rows
print("\n--- Checking AVOR.docx rows specifically ---")
res = supabase.table("knowledge_chunks").select("id, embedding").eq("source_file", "AVOR.docx").limit(1).execute()
if res.data:
    emb = res.data[0].get("embedding")
    if emb is None:
        print("PROBLEM: embedding is NULL for AVOR.docx rows!")
    elif isinstance(emb, str):
        print(f"Embedding is a STRING (len={len(emb)}): {emb[:100]}")
    elif isinstance(emb, list):
        print(f"Embedding is a list, len={len(emb)}, sample={emb[:5]}")
        # Check for zeros
        zeros = sum(1 for v in emb if v == 0.0)
        print(f"  Zero values: {zeros} out of {len(emb)}")
else:
    print("No AVOR.docx rows found")
