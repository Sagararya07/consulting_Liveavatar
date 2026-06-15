import asyncio
from services.embedding_service import embed_texts
import numpy as np

async def main():
    texts = [f"This is test chunk number {i} with some content." for i in range(52)]
    try:
        res = await embed_texts(texts)
        print("Embeddings count:", len(res))
        print("First embedding length:", len(res[0]))
        print("First embedding first element type:", type(res[0][0]))
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
