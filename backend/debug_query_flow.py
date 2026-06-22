"""Test the actual query flow end-to-end to find the exact failure point."""
import asyncio
import json
from config import supabase
from services.embedding_service import embed_text

async def test_query_flow():
    # Step 1: Generate a test embedding
    print("Step 1: Generating embedding for test query...")
    try:
        emb = await embed_text("What is AVOR?")
        print(f"  Embedding generated: len={len(emb)}, first_5={emb[:5]}")
        print(f"  All zeros? {all(v == 0 for v in emb)}")
        print(f"  Embedding dim: {len(emb)}")
    except Exception as e:
        print(f"  ERROR generating embedding: {e}")
        return

    # Step 2: Call match_chunks RPC
    print("\nStep 2: Testing match_chunks RPC...")
    try:
        # Check what we're sending
        print(f"  Sending query_embedding type: {type(emb)}")
        print(f"  Sending query_embedding len: {len(emb)}")
        
        result = supabase.rpc(
            "match_chunks",
            {"query_embedding": emb, "match_count": 5},
        ).execute()
        
        print(f"  RPC returned: {len(result.data) if result.data else 0} results")
        if result.data:
            for r in result.data:
                print(f"    id={r['id']}, similarity={r['similarity']}, content={r['content'][:50]}")
        else:
            print("  No results returned!")
    except Exception as e:
        print(f"  RPC ERROR: {e}")

    # Step 3: Check what's actually in knowledge_chunks
    print("\nStep 3: Checking knowledge_chunks table...")
    try:
        res = supabase.table("knowledge_chunks").select("id, content, source_file").execute()
        print(f"  Total rows: {len(res.data) if res.data else 0}")
        if res.data:
            for r in res.data[:5]:
                print(f"    source={r['source_file']}, content={r['content'][:50]}")
    except Exception as e:
        print(f"  ERROR: {e}")

asyncio.run(test_query_flow())
