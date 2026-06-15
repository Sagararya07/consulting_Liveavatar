from fastapi import APIRouter, HTTPException
from models.schemas import QueryRequest, QueryResponse
from services.query_service import answer_query
from services.memory_service import get_or_create_user, save_session_summary

router = APIRouter(prefix="/query", tags=["query"])


@router.post("/ask", response_model=QueryResponse)
async def ask(body: QueryRequest):
    get_or_create_user(body.user_id)

    try:
        answer = await answer_query(body.user_id, body.query, body.language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return QueryResponse(answer=answer, user_id=body.user_id)


@router.post("/end-session")
async def end_session(user_id: str, conversation_text: str):
    """
    Call this when the user closes the avatar session.
    Pass the full conversation transcript so Claude can summarise it.
    """
    try:
        await save_session_summary(user_id, conversation_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "Session summary saved."}
