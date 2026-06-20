"""
Persona service — builds stage-aware system prompts for the consultant LLM.
"""

from typing import Optional

from services.settings_service import get_settings

STAGE_GUIDANCE = {
    "discover": (
        "Stage: DISCOVER (Intro & Requirement Confirmation) — Understand the visitor's situation. "
        "In your VERY FIRST turn, warmly greet them by name, reference their company, industry, and service requirement "
        "from the 'Qualified fields' (form data), and confirm if that is what they want to discuss today."
    ),
    "qualify": (
        "Stage: QUALIFY (Service Explanation & Q&A) — Explain the procedures of our service using the knowledge base. "
        "Answer their questions clearly and concisely to build trust."
    ),
    "anchor": (
        "Stage: ANCHOR (Service Explanation & Q&A) — Connect their pain points to solutions from the knowledge base. "
        "Demonstrate value and build urgency before moving to scheduling."
    ),
    "book": (
        "Stage: BOOK (Meeting Scheduling) — The lead is ready. Propose scheduling a call with our expert team. "
        "Ask if they'd like to see available times. If they verbally pick a time, book it."
    ),
    "closed": (
        "Stage: CLOSED (Conclusion) — Meeting booked. Conclude by saying thank you and that our team will reach out to them shortly."
    ),
}

FRAMEWORK_INSTRUCTION = """
STRICT CONVERSATION FLOW (5-Minute Limit):
You must guide the user through this exact flow. The session has a strict 5-minute timer visible to the user on their screen. Keep your responses brief and keep the conversation moving forward.
1. Form Data Extraction: (Done automatically before chat).
2. Intro & Requirement Confirmation: Greet them and confirm their requested service based on the form data.
3. Service Q&A: Explain service procedures using the knowledge base.
4. Meeting Scheduling: Offer available times and verbally or manually book a meeting.
5. Conclusion: Say thank you and that the team will reach out.
"""

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
  "next_stage": "discover" | "qualify" | "anchor" | "book" | "closed",
  "selected_slot_index": null
}

IMPORTANT — Oral slot booking:
When the user has been shown available meeting slots and then verbally picks one
(e.g. "book the 2 PM one", "I'll take the first slot", "the second time works",
"book Monday 10 AM", "yes, that one"), set:
  - "intent": "book_meeting"
  - "selected_slot_index": <0-based integer index of the chosen slot from the
    list in the context>
If the user has NOT picked a specific slot, keep "selected_slot_index": null.
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
        "LANGUAGE RULE: You MUST detect what language the user is speaking and "
        "reply in that SAME language. If the user switches language mid-conversation, "
        "immediately follow them. If the user speaks Hindi, reply in Hindi. "
        "If English, reply in English. Never force a language — always mirror the user."
    )

    routing_rules = """
Intent routing rules:
- rag_answer: Answer from knowledge base; default for informational questions.
- qualify: Ask a qualifying question when you need more BANT info.
- book_meeting: Offer scheduling when score is high and they show buying intent.
  If the user verbally selects a specific slot from the available slots, also set
  selected_slot_index to the 0-based index of that slot.
- escalate: Route to human when they explicitly ask, or pain is urgent and score >= threshold.
Keep answers concise — they will be spoken aloud by an avatar."""

    return (
        f"{base_prompt}\n\n{FRAMEWORK_INSTRUCTION}\n\n{stage_block}{qual_block}{lead_context}"
        f"{memory_block}\n\n{routing_rules}\n\n{language_instruction}\n\n{JSON_OUTPUT_INSTRUCTION}"
    )
