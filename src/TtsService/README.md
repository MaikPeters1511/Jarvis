# TtsService (Python/FastAPI)

Qwen3-TTS voice cloning service for the Javis voice assistant.

## Requirements

- Python 3.13 (managed by `uv` via Aspire)
- `sox` (system package for audio processing)
- Apple Silicon (MPS) or NVIDIA GPU (CUDA) or CPU (slow)
- ~3 GB disk for the Qwen3-TTS 1.7B Base model

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check + stats |
| `GET` | `/voices` | List all uploaded reference voices |
| `POST` | `/voices` | Upload new reference voice (multipart: `name`, `ref_text`, `language`, `file`) |
| `DELETE` | `/voices/{id}` | Delete a reference voice |
| `POST` | `/synthesize` | Synthesize speech with voice cloning |

## Environment Variables

- `QWEN_TTS_BASE_MODEL` (default: `Qwen/Qwen3-TTS-12Hz-1.7B-Base`)
- `QWEN_TTS_DEVICE` (default: `mps`; alternatives: `cuda`, `cpu`, `auto`)
- `QWEN_TTS_DTYPE` (default: `bfloat16`; alternatives: `float16`, `float32`, `int8`)
- `JAVIS_VOICES_DIR` (default: `/tmp/javis/voices`)

## Local Development

```bash
cd src/TtsService
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```
