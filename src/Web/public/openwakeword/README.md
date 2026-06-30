# openWakeWord Models

This directory hosts the openWakeWord ONNX models used for browser-side wake-word detection.

## Required files (download manually or via the helper script)

1. **melspectrogram.onnx** – Mel-spectrogram feature extractor
2. **embedding_model.onnx** – Speech embedding model
3. **silero_vad.onnx** – Voice Activity Detection (VAD) for gating
4. **hey_jarvis_v0.1.onnx** – Pre-trained "hey jarvis" classifier (placeholder)
5. **ort/** – ONNX Runtime Web WASM binaries

## Download

Run the helper script from the repository root:

```bash
../scripts/download-wakeword-models.sh
```

Or manually:

```bash
mkdir -p ../public/openwakeword/{models,ort}

# Feature extractor models
wget -O public/openwakeword/models/melspectrogram.onnx \
  https://github.com/dsacms/openWakeWord/raw/main/openwakeword/resources/models/melspectrogram.onnx

wget -O public/openwakeword/models/embedding_model.onnx \
  https://github.com/dsacms/openWakeWord/raw/main/openwakeword/resources/models/embedding_model.onnx

wget -O public/openwakeword/models/silero_vad.onnx \
  https://github.com/dsacms/openWakeWord/raw/main/openwakeword/resources/models/silero_vad_v4.onnx

# Pre-trained keyword (placeholder — train your own "javis" later)
wget -O public/openwakeword/models/hey_jarvis_v0.1.onnx \
  https://github.com/dsacms/openWakeWord/raw/main/openwakeword/resources/models/hey_jarvis_v0.1.onnx

# ONNX Runtime Web WASM files
wget -O public/openwakeword/ort/ort-wasm.wasm \
  https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/ort-wasm.wasm
wget -O public/openwakeword/ort/ort-wasm-simd.wasm \
  https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/ort-wasm-simd.wasm
```

## Training a custom "javis" wake-word

Use the [openWakeWord Colab notebook](https://colab.research.google.com/drive/1q1oe2v3ChIIw_zf_GVn9c2c_5nvb1j7p)
to train a custom model. Configuration:

```python
config["target_phrase"] = ["javis"]
config["model_name"] = "javis"
config["n_samples"] = 10000
```

Then replace `hey_jarvis_v0.1.onnx` with your `javis_v0.1.onnx` and update
`WakewordService.init()` in `src/app/core/wakeword/wakeword.service.ts`.
