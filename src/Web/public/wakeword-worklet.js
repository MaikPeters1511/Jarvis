/**
 * AudioWorklet processor for the WakewordService.
 * Sends 1280-sample (80 ms @ 16 kHz) Float32 chunks to the main thread
 * for openWakeWord inference.
 */
class WakewordProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(1280);
    this.filled = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;

    let offset = 0;
    while (offset < input.length) {
      const space = this.buffer.length - this.filled;
      const copy = Math.min(space, input.length - offset);
      this.buffer.set(input.subarray(offset, offset + copy), this.filled);
      this.filled += copy;
      offset += copy;

      if (this.filled >= this.buffer.length) {
        // Send a copy to the main thread (transfer semantics would lose the buffer)
        this.port.postMessage(this.buffer.slice());
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('wakeword-processor', WakewordProcessor);
