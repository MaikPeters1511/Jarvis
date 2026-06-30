"""Qwen3-TTS engine with voice cloning and LRU prompt cache."""
from __future__ import annotations

import asyncio
import hashlib
import os
import uuid
from collections import OrderedDict
from pathlib import Path
from typing import Any

import numpy as np
import torch
from loguru import logger

try:
    from qwen_tts import Qwen3TTSModel
except ImportError:
    Qwen3TTSModel = None
    logger.warning("qwen-tts not installed - will fail at runtime")

# Voice storage directory (relative to project root or /tmp)
VOICES_DIR = Path(os.getenv("JAVIS_VOICES_DIR", "/tmp/javis/voices"))
VOICES_DIR.mkdir(parents=True, exist_ok=True)


class TtsEngine:
    """Async wrapper around Qwen3-TTS with voice cloning and prompt caching."""

    PROMPT_CACHE_MAX = 16  # LRU cache size

    def __init__(self, model: Any, model_name: str, device: str):
        self.model = model
        self.model_name = model_name
        self.device = device
        self._prompt_cache: OrderedDict[str, Any] = OrderedDict()
        self._lock = asyncio.Lock()

    @property
    def is_ready(self) -> bool:
        return self.model is not None

    @classmethod
    async def create(cls, model_name: str, device: str, dtype: str) -> "TtsEngine":
        """Load the Qwen3-TTS model in a background thread."""
        if Qwen3TTSModel is None:
            raise RuntimeError("qwen-tts package is not installed. Run: uv pip install qwen-tts")

        torch_dtype = {
            "bfloat16": torch.bfloat16,
            "float16": torch.float16,
            "float32": torch.float32,
            "int8": torch.int8,
        }.get(dtype, torch.bfloat16)

        # Run blocking torch.load in threadpool
        def _load():
            logger.info(f"Instantiating Qwen3TTSModel on {device}...")
            return Qwen3TTSModel.from_pretrained(
                model_name,
                device_map=device,
                dtype=torch_dtype,
            )

        model = await asyncio.get_event_loop().run_in_executor(None, _load)
        return cls(model=model, model_name=model_name, device=device)

    async def close(self) -> None:
        """Cleanup resources."""
        self._prompt_cache.clear()

    # ── Voice Management ─────────────────────────────────────────────────
    async def list_voices(self) -> list[dict]:
        """List all available reference voices."""
        voices = []
        for meta_path in VOICES_DIR.glob("*.json"):
            try:
                import json

                meta = json.loads(meta_path.read_text())
                wav_path = VOICES_DIR / meta["filename"]
                if wav_path.exists():
                    voices.append(
                        {
                            "id": meta["id"],
                            "name": meta["name"],
                            "language": meta.get("language", "Auto"),
                            "ref_text": meta.get("ref_text", ""),
                            "filename": meta["filename"],
                            "size_bytes": wav_path.stat().st_size,
                            "created_at": meta.get("created_at"),
                        }
                    )
            except Exception as e:
                logger.warning(f"Failed to read voice meta {meta_path}: {e}")
        return sorted(voices, key=lambda v: v["name"])

    async def save_voice(
        self, name: str, ref_text: str, language: str, audio_bytes: bytes
    ) -> dict:
        """Save a new reference voice."""
        voice_id = str(uuid.uuid4())[:12]
        filename = f"{voice_id}.wav"
        wav_path = VOICES_DIR / filename
        wav_path.write_bytes(audio_bytes)

        import json
        from datetime import datetime, timezone

        meta = {
            "id": voice_id,
            "name": name,
            "ref_text": ref_text,
            "language": language,
            "filename": filename,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        meta_path = VOICES_DIR / f"{voice_id}.json"
        meta_path.write_text(json.dumps(meta, indent=2))

        logger.info(f"Saved voice '{name}' ({voice_id}) - {len(audio_bytes)} bytes")
        return meta

    async def delete_voice(self, voice_id: str) -> bool:
        """Delete a reference voice."""
        meta_path = VOICES_DIR / f"{voice_id}.json"
        if not meta_path.exists():
            return False
        import json

        meta = json.loads(meta_path.read_text())
        (VOICES_DIR / meta["filename"]).unlink(missing_ok=True)
        meta_path.unlink()
        # Invalidate cache
        self._prompt_cache.clear()
        logger.info(f"Deleted voice {voice_id}")
        return True

    def _get_voice(self, voice_id: str) -> tuple[Path, str, str]:
        """Get voice file path and ref_text by id."""
        import json

        meta_path = VOICES_DIR / f"{voice_id}.json"
        if not meta_path.exists():
            raise FileNotFoundError(f"Voice {voice_id} not found")
        meta = json.loads(meta_path.read_text())
        wav_path = VOICES_DIR / meta["filename"]
        if not wav_path.exists():
            raise FileNotFoundError(f"Voice file {wav_path} missing")
        return wav_path, meta.get("ref_text", ""), meta.get("language", "Auto")

    # ── Synthesis ────────────────────────────────────────────────────────
    async def clone_and_synthesize(
        self,
        text: str,
        language: str,
        ref_audio_id: str,
        ref_text: str | None = None,
        temperature: float = 0.9,
        top_p: float = 1.0,
        top_k: int = 50,
        max_tokens: int = 2048,
        repetition_penalty: float = 1.05,
    ) -> tuple[np.ndarray, int]:
        """Synthesize speech with voice cloning (ICL mode)."""

        ref_path, stored_ref_text, _ = self._get_voice(ref_audio_id)
        effective_ref_text = ref_text or stored_ref_text

        if not effective_ref_text:
            raise ValueError(
                f"ref_text is required for voice {ref_audio_id} (no stored ref_text)"
            )

        # Cache key on file content hash + params
        cache_key = self._file_hash(ref_path)
        prompt = self._prompt_cache.get(cache_key)
        if prompt is None:
            logger.info(f"Building voice clone prompt for {ref_audio_id} (cache miss)")
            prompt = await self._build_prompt(ref_path, effective_ref_text)
            if len(self._prompt_cache) >= self.PROMPT_CACHE_MAX:
                self._prompt_cache.popitem(last=False)
            self._prompt_cache[cache_key] = prompt
        else:
            self._prompt_cache.move_to_end(cache_key)
            logger.debug(f"Prompt cache hit for {ref_audio_id}")

        # Run blocking inference in threadpool
        wavs, sr = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: self.model.generate_voice_clone(
                text=text,
                language=language,
                voice_clone_prompt=prompt,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                top_k=top_k,
                repetition_penalty=repetition_penalty,
            ),
        )
        return wavs[0], sr

    async def _build_prompt(self, ref_path: Path, ref_text: str) -> Any:
        """Build reusable voice clone prompt in threadpool."""

        def _build():
            return self.model.create_voice_clone_prompt(
                ref_audio=str(ref_path),
                ref_text=ref_text,
                x_vector_only_mode=False,
            )

        return await asyncio.get_event_loop().run_in_executor(None, _build)

    @staticmethod
    def _file_hash(path: Path) -> str:
        """Quick file content hash for cache key."""
        h = hashlib.md5()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                h.update(chunk)
        return h.hexdigest()[:16]
