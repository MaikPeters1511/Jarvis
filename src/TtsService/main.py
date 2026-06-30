"""Javis TTS Service - FastAPI wrapper around Qwen3-TTS for voice cloning."""
from __future__ import annotations

import io
import os
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

import soundfile as sf
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from loguru import logger

from tts_engine import TtsEngine

# Configure logging
logger.remove()
logger.add(
    lambda msg: print(msg, end=""),
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | {message}",
)

engine: TtsEngine | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Load the Qwen3-TTS model on startup."""
    global engine
    logger.info("🚀 Starting Javis TTS Service...")

    model_name = os.getenv("QWEN_TTS_BASE_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")
    device = os.getenv("QWEN_TTS_DEVICE", "mps")
    dtype = os.getenv("QWEN_TTS_DTYPE", "bfloat16")

    logger.info(f"Loading model: {model_name} on {device} (dtype={dtype})")
    t0 = time.time()
    engine = await TtsEngine.create(model_name=model_name, device=device, dtype=dtype)
    logger.info(f"✅ Model loaded in {time.time() - t0:.1f}s")

    yield

    logger.info("Shutting down TTS service")
    if engine:
        await engine.close()


app = FastAPI(
    title="Javis TTS Service",
    description="Qwen3-TTS voice cloning for the Javis voice assistant",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {
        "status": "ok" if engine and engine.is_ready else "loading",
        "model": engine.model_name if engine else None,
        "device": engine.device if engine else None,
        "cached_prompts": len(engine._prompt_cache) if engine else 0,
        "voices": len(await engine.list_voices()) if engine else 0,
    }


@app.get("/voices")
async def list_voices() -> list[dict]:
    """List all uploaded reference voices."""
    if not engine:
        raise HTTPException(503, "Engine not ready")
    return await engine.list_voices()


@app.post("/voices")
async def upload_voice(
    name: str = Form(...),
    ref_text: str = Form(...),
    language: str = Form("Auto"),
    file: UploadFile = File(...),
) -> dict:
    """Upload a new reference voice for cloning."""
    if not engine:
        raise HTTPException(503, "Engine not ready")
    audio_bytes = await file.read()
    voice = await engine.save_voice(
        name=name, ref_text=ref_text, language=language, audio_bytes=audio_bytes
    )
    return voice


@app.delete("/voices/{voice_id}")
async def delete_voice(voice_id: str) -> dict:
    """Delete a reference voice."""
    if not engine:
        raise HTTPException(503, "Engine not ready")
    success = await engine.delete_voice(voice_id)
    if not success:
        raise HTTPException(404, f"Voice {voice_id} not found")
    return {"deleted": voice_id}


@app.post("/synthesize")
async def synthesize(payload: dict) -> StreamingResponse:
    """Synthesize speech with optional voice cloning.

    Body:
    {
        "text": "Text to synthesize",
        "language": "Auto" | "English" | "German" | ...,
        "ref_audio_id": "voice-uuid",
        "ref_text": "Transcript of reference (auto-fetched if omitted)",
        "temperature": 0.9,
        "top_p": 1.0,
        "top_k": 50,
        "max_tokens": 2048,
        "repetition_penalty": 1.05
    }
    """
    if not engine:
        raise HTTPException(503, "Engine not ready")

    text = payload.get("text")
    if not text or not text.strip():
        raise HTTPException(400, "text is required")

    ref_audio_id = payload.get("ref_audio_id")
    if not ref_audio_id:
        raise HTTPException(400, "ref_audio_id is required for voice cloning")

    t0 = time.time()
    wav, sr = await engine.clone_and_synthesize(
        text=text,
        language=payload.get("language", "Auto"),
        ref_audio_id=ref_audio_id,
        ref_text=payload.get("ref_text"),
        temperature=payload.get("temperature", 0.9),
        top_p=payload.get("top_p", 1.0),
        top_k=payload.get("top_k", 50),
        max_tokens=payload.get("max_tokens", 2048),
        repetition_penalty=payload.get("repetition_penalty", 1.05),
    )
    elapsed = time.time() - t0
    logger.info(f"Synthesized {len(text)} chars in {elapsed:.2f}s")

    # Encode as WAV in-memory
    buf = io.BytesIO()
    sf.write(buf, wav, sr, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="audio/wav",
        headers={
            "X-Sample-Rate": str(sr),
            "X-Duration-MS": str(int(len(wav) / sr * 1000)),
            "X-Synthesis-Time-MS": str(int(elapsed * 1000)),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    """Log and return 500 with error message."""
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )
