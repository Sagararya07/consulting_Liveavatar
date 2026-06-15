import numpy as np

IN_MEMORY_KNOWLEDGE: list[dict] = []


def store_chunks(rows: list[dict]) -> int:
    for row in rows:
        IN_MEMORY_KNOWLEDGE.append(
            {
                "content": row["content"],
                "embedding": row["embedding"],
                "source_file": row.get("source_file", ""),
            }
        )
    return len(rows)


def search_chunks(query_embedding: list[float], top_k: int = 5) -> list[str]:
    if not IN_MEMORY_KNOWLEDGE:
        return []

    query = np.array(query_embedding, dtype=float)
    query_norm = np.linalg.norm(query)
    if query_norm == 0:
        return []

    scores: list[tuple[float, str]] = []
    for chunk in IN_MEMORY_KNOWLEDGE:
        vector = np.array(chunk["embedding"], dtype=float)
        vector_norm = np.linalg.norm(vector)
        if vector_norm == 0:
            continue
        similarity = float(np.dot(query, vector) / (query_norm * vector_norm))
        scores.append((similarity, chunk["content"]))

    scores.sort(reverse=True, key=lambda item: item[0])
    return [content for _, content in scores[:top_k]]
