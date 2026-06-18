"""
Persona service — builds stage-aware system prompts for the consultant LLM.
"""

from typing import Optional

from services.settings_service import get_settings

STAGE_GUIDANCE = {
    "discover": (
        "Stage: DISCOVER — Understand the visitor's situation and goals. "
        "Answer their question using the knowledge base, then ask one open-ended "
        "follow-up to learn about their business or challenge."
    ),
    "qualify": (
        "Stage: QUALIFY — Gather BANT signals: Budget, Authority, Need, Timeline. "
        "Ask one targeted qualifying question per turn. Do not pitch yet."
    ),
    "anchor": (
        "Stage: ANCHOR — Connect their pain points to solutions from the knowledge base. "
        "Demonstrate value and build urgency. Mention relevant outcomes or case patterns."
    ),
    "book": (
        "Stage: BOOK — The lead is warm enough. Naturally offer to schedule a call "
        "with a human expert. Ask if they'd like to see available times."
    ),
    "closed": (
        "Stage: CLOSED — Meeting booked or conversation concluded. "
        "Confirm next steps and thank them warmly."
    ),
}

JSON_OUTPUT_INSTRUCTION = """
You MUST respond with valid JSON only — no markdown, no preamble. Use this exact schema:
{
  "intent": "rag_answer" | "qualify" | "book_meeting" | "escalate",
  "answer": "<spoken response, 2-4 sentences max, conversational>",
  "lead_signals": {
    "pain": "<pain point or null>",
    "budget_hint": "<budget signal or null>",
    "timeline_hint": "<timeline signal or null>",
    "authority_hint": "<decision-maker signal or null>",
    "intent_strength": "low" | "medium" | "high" | null
  },
  "qualified_fields": {
    "company_size": "<value or null>",
    "role": "<value or null>",
    "budget": "<value or null>",
    "timeline": "<value or null>"
  },
  "objections": ["<any new objection heard this turn>"],
  "score_delta": <integer 0-25>,
  "next_stage": "discover" | "qualify" | "anchor" | "book" | "closed"
}
"""


def build_system_prompt(
    *,
    stage: str,
    lead_score: int,
    lead_status: str,
    signals: dict,
    qualified_fields: dict,
    structured_memory: str = "",
    missing_fields: Optional[list] = None,
    language: str = "en",
) -> str:
    settings = get_settings()
    base_prompt = settings.get("system_prompt", "")
    playbook = settings.get("consultant_playbook", "")
    qual_questions = settings.get("qualification_questions", [])

    stage_block = STAGE_GUIDANCE.get(stage, STAGE_GUIDANCE["discover"])
    if playbook:
        stage_block = f"{stage_block}\n\nPlaybook:\n{playbook}"

    qual_block = ""
    if qual_questions and stage in ("discover", "qualify"):
        qual_block = "\n\nSuggested qualifying questions (use naturally, one at a time):\n"
        qual_block += "\n".join(f"- {q}" for q in qual_questions)

    if missing_fields:
        qual_block += f"\n\nStill need to learn: {', '.join(missing_fields)}"

    lead_context = (
        f"\n\nLead profile:\n"
        f"- Score: {lead_score}/100 ({lead_status})\n"
        f"- Current stage: {stage}\n"
        f"- Signals so far: {signals or 'none'}\n"
        f"- Qualified fields: {qualified_fields or 'none'}"
    )

    memory_block = ""
    if structured_memory:
        memory_block = f"\n\nStructured memory:\n{structured_memory}"

    language_instruction = (
        "Respond in the same language the user used."
        if language != "en"
        else "Respond in English unless the user writes in another language."
    )

    routing_rules = """
Intent routing rules:
- rag_answer: Answer from knowledge base; default for informational questions.
- qualify: Ask a qualifying question when you need more BANT info.
- book_meeting: Offer scheduling when score is high and they show buying intent.
- escalate: Route to human when they explicitly ask, or pain is urgent and score >= threshold.
Keep answers concise — they will be spoken aloud by an avatar."""

    return (
        f"{base_prompt}\n\n{stage_block}{qual_block}{lead_context}"
        f"{memory_block}\n\n{routing_rules}\n\n{language_instruction}\n\n{JSON_OUTPUT_INSTRUCTION}"
    )
