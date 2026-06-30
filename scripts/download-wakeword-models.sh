#!/usr/bin/env bash
# Download all openWakeWord ONNX models + ONNX Runtime Web WASM files
# Run from the repository root: ./scripts/download-wakeword-models.sh

set -e

TARGET="src/Web/public/openwakeword"
mkdir -p "$TARGET/models" "$TARGET/ort"

BASE="https://github.com/dsacms/openWakeWord/raw/main/openwakeword/resources/models"

echo "Downloading feature extractor models..."
wget -q -O "$TARGET/models/melspectrogram.onnx" \
  "$BASE/melspectrogram.onnx"
wget -q -O "$TARGET/models/embedding_model.onnx" \
  "$BASE/embedding_model.onnx"
wget -q -O "$TARGET/models/silero_vad.onnx" \
  "$BASE/silero_vad_v4.onnx"

echo "Downloading pre-trained 'hey_jarvis' classifier (placeholder)..."
wget -q -O "$TARGET/models/hey_jarvis_v0.1.onnx" \
  "$BASE/hey_jarvis_v0.1.onnx"

echo "Downloading ONNX Runtime Web WASM files..."
ORT_BASE="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist"
wget -q -O "$TARGET/ort/ort-wasm.wasm" "$ORT_BASE/ort-wasm.wasm"
wget -q -O "$TARGET/ort/ort-wasm-simd.wasm" "$ORT_BASE/ort-wasm-simd.wasm"
wget -q -O "$TARGET/ort/ort-wasm-threaded.wasm" "$ORT_BASE/ort-wasm-threaded.wasm"

echo ""
echo "✅ Done! Models in $TARGET:"
ls -la "$TARGET/models/" "$TARGET/ort/"
echo ""
echo "Next: train a custom 'javis' model (see src/Web/public/openwakeword/README.md)"
