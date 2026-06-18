from fastapi import APIRouter, Depends, HTTPException
from models.schemas import QueryRequest, QueryResponse
from services.query_service import answer_query
from middleware.auth_middleware import get_current_user
from services.conversation_service import get_or_create_conversation, end_conversation

router = APIRouter(prefix="/query", tags=["query"])


@router.post("/ask", response_model=QueryResponse)
async def ask(
    body: QueryRequest,
    current_user: dict = Depends(get_current_user),
):
    # Use authenticated user if present, otherwise fall back to provided ID
    user_id = current_user["id"]

    try:
        if body.conversation_id:
            conv_id = body.conversation_id
        else:
            conv = get_or_create_conversation(user_id=user_id, language=body.language)
            conv_id = conv["id"]

        result = await answer_query(
            user_id, conv_id, body.query, body.language, body.timezone or "UTC"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return QueryResponse(
        answer=result.answer,
        user_id=user_id,
        conversation_id=conv_id,
        intent=result.intent,
        lead_score=result.lead_score,
        stage=result.stage,
        status=result.status,
        score_delta=result.score_delta,
        ui_action=result.ui_action,
    )


@router.post("/end-session")
async def end_session(user_id: str, conversation_text: str = "", conversation_id: str = ""):
    """
    Deprecated: Call POST /conversations/{id}/end instead.
    This remains for backwards compatibility if the frontend hasn't been updated.
    """
    if conversation_id:
        try:
            await end_conversation(conversation_id)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        return {"message": "Session summary saved (via conversation service)."}
    
    # If no conversation_id, we can't do much with the new system easily without it.
    return {"message": "Session ended. Please migrate to /conversations/{id}/end endpoint."}

