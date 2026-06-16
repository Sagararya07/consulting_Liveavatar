import logging
from config import supabase, anthropic_client
from services.embedding_service import embed_text
from services.knowledge_store import search_chunks
from services.memory_service import fetch_past_summary

logger = logging.getLogger(__name__)

TOP_K = 5


async def answer_query(user_id: str, query: str, language: str = "en") -> str:
    chunks = []
    query_embedding = await embed_text(query)
    logger.info(f"Generated query embedding, dim={len(query_embedding)}")

    try:
        result = supabase.rpc(
            "match_chunks",
            {"query_embedding": query_embedding, "match_count": TOP_K},
        ).execute()
        logger.info(f"match_chunks RPC returned {len(result.data) if result.data else 0} rows")
        if result.data:
            # Filter out rows with NaN or None similarity (caused by zero-norm embeddings)
            valid_rows = [
                row for row in result.data
                if row.get("similarity") is not None
                and str(row["similarity"]).lower() != "nan"
                and float(row["similarity"]) > 0.0
            ]
            logger.info(f"After filtering invalid similarities: {len(valid_rows)} valid rows")
            chunks = [row["content"] for row in valid_rows]
        if not chunks:
            logger.info("No valid Supabase results, trying in-memory fallback")
            chunks = search_chunks(query_embedding, TOP_K)
    except Exception as e:
        logger.warning(
            f"Supabase search failed, falling back to in-memory search: {e}"
        )
        chunks = search_chunks(query_embedding, TOP_K)

    context = "\n\n---\n\n".join(chunks) if chunks else "No relevant information found."
    logger.info(f"Context built from {len(chunks)} chunks")

    past_summary = fetch_past_summary(user_id)

    memory_block = ""
    if past_summary:
        memory_block = f"\n\nUser memory (from previous sessions):\n{past_summary}"

    if language == "multi":
        language_instruction = "Respond in the same language the user speaks."
    elif language == "en":
        language_instruction = "Respond in English."
    else:
        language_instruction = (
            f"Always respond in the language with ISO code '{language}'."
        )

    system_prompt = f"""You are a helpful, friendly AI avatar consultant.
Answer the user's question using only the provided knowledge base context.
If the context does not contain the answer, say you don't have that information.
Keep answers concise and conversational — they will be spoken aloud by an avatar.
{language_instruction}{memory_block}"""

    try:
        response = await anthropic_client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=512,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": f"Context from knowledge base:\n{context}\n\nUser question: {query}",
                }
            ],
        )
        return response.content[0].text
    except Exception as e:
        logger.error(f"Anthropic message creation failed: {e}")
        return f"I apologize, but I encountered an error communicating with my AI service: {e}"

