import asyncio
from config import supabase
from services.embedding_service import embed_texts

async def main():
    texts = [f"This is test chunk number {i} with some content." * 10 for i in range(52)]
    try:
        embeddings = await embed_texts(texts)
        rows = [
            {
                "content": chunk,
                "embedding": embedding,
                "source_file": "HF_real_insert.docx",
            }
            for chunk, embedding in zip(texts, embeddings)
        ]
        res = supabase.table("knowledge_chunks").insert(rows).execute()
        print("Success:", len(res.data))
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
