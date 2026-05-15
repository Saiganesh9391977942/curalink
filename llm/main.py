import json
import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field


GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")


def build_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=api_key)


client: genai.Client | None = None

app = FastAPI(title="CuraLink Gemini LLM")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    disease: str = Field(default="")
    query: str
    publications: list[dict[str, Any]] = Field(default_factory=list)
    trials: list[dict[str, Any]] = Field(default_factory=list)
    chat_history: list[dict[str, Any]] = Field(default_factory=list)


def get_client() -> genai.Client:
    global client
    if client is None:
        client = build_client()
    return client


def compact_publications(publications: list[dict[str, Any]]) -> str:
    return "\n".join(
        f"- {p.get('title', 'Untitled')} ({p.get('year', 'n.d.')}): "
        f"{str(p.get('abstract', ''))[:500]}"
        for p in publications[:6]
    )


def compact_trials(trials: list[dict[str, Any]]) -> str:
    return "\n".join(
        f"- {t.get('title', 'Untitled')} | Status: {t.get('status', 'Unknown')} | "
        f"Location: {t.get('location', 'Not listed')}"
        for t in trials[:4]
    )


def compact_history(history: list[dict[str, Any]]) -> str:
    return "\n".join(
        f"{m.get('role', 'user').upper()}: {m.get('content', '')}"
        for m in history[-6:]
    )


def build_prompt(req: QueryRequest) -> str:
    topic = req.disease or req.query
    return f"""
You are CuraLink, a careful medical research assistant for patient education.

Rules:
- Give evidence-aware, plain-language guidance.
- Do not diagnose the user.
- Recommend emergency care for red-flag symptoms when relevant.
- Keep the response concise and practical.
- Return only valid JSON. Do not wrap it in markdown.

CONVERSATION HISTORY:
{compact_history(req.chat_history)}

CONDITION OR TOPIC:
{topic}

USER QUESTION:
{req.query}

PUBLICATIONS:
{compact_publications(req.publications) or "No publication context supplied."}

CLINICAL TRIALS:
{compact_trials(req.trials) or "No clinical trial context supplied."}

Required JSON shape:
{{
  "condition_overview": "string",
  "research_insights": "string",
  "clinical_trials_summary": "string",
  "recommendations": "string",
  "disclaimer": "This is educational information and is not a medical diagnosis. Consult a qualified doctor."
}}
"""


def parse_model_json(text: str) -> dict[str, Any]:
    cleaned = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


def generate_with_model(model: str, prompt: str):
    gemini = get_client()
    return gemini.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.25,
            response_mime_type="application/json",
        ),
    )


@app.get("/")
def home():
    return {
        "message": "CuraLink Gemini LLM server running",
        "model": GEMINI_MODEL,
        "fallback_model": GEMINI_FALLBACK_MODEL,
        "api_key": "configured" if os.getenv("GEMINI_API_KEY") else "missing",
    }


@app.post("/reason")
async def reason(req: QueryRequest):
    prompt = build_prompt(req)
    model_used = GEMINI_MODEL

    try:
        response = generate_with_model(GEMINI_MODEL, prompt)
    except errors.APIError as primary_error:
        if GEMINI_FALLBACK_MODEL and GEMINI_FALLBACK_MODEL != GEMINI_MODEL:
            try:
                response = generate_with_model(GEMINI_FALLBACK_MODEL, prompt)
                model_used = GEMINI_FALLBACK_MODEL
            except Exception as fallback_error:
                raise HTTPException(
                    status_code=502,
                    detail=f"Gemini failed: {fallback_error}",
                ) from fallback_error
        else:
            raise HTTPException(
                status_code=502,
                detail=f"Gemini failed: {primary_error}",
            ) from primary_error
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Gemini failed: {error}") from error

    text = (response.text or "").strip()
    if not text:
        raise HTTPException(status_code=502, detail="Gemini returned an empty response")

    try:
        parsed = parse_model_json(text)
    except Exception:
        parsed = {
            "condition_overview": text,
            "research_insights": "",
            "clinical_trials_summary": "",
            "recommendations": "",
            "disclaimer": "This is educational information and is not a medical diagnosis. Consult a qualified doctor.",
        }

    parsed["_model"] = model_used
    return parsed
