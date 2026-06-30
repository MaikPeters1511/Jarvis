import { Injectable, NgZone, OnDestroy, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface WakewordConfig {
  threshold?: number;
  cooldownMs?: number;
}

/**
 * openWakeWord-JS based wake word detector.
 * Runs in the browser via ONNX Runtime Web. Detects the configured keyword
 * (default: "hey_jarvis" as a placeholder; can be replaced with a custom
 * "javis" model trained via the openWakeWord Colab notebook).
 */
@Injectable({ providedIn: 'root' })
export class WakewordService implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly _ready = signal(false);
  private readonly _listening = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly ready = this._ready.asReadonly();
  readonly listening = this._listening.asReadonly();
  readonly error = this._error.asReadonly();

  /** Emits when the wake word is detected. */
  readonly detected$ = new Subject<{ score: number; timestamp: number }>();

  private model: any = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isRunning = false;

  async init(): Promise<void> {
    if (this._ready()) return;
    try {
      // Lazy-load openwakeword-js (uses dynamic import to keep main bundle small)
      const { Model } = await import('openwakeword-js');

      // Try to use custom "hey_jarvis" model first; if that fails, fall back to a bundled model
      try {
        this.model = new Model({
          wakewordModels: ['/openwakeword/models/hey_jarvis_v0.1.onnx'],
          melspectrogramModelPath: '/openwakeword/models/melspectrogram.onnx',
          embeddingModelPath: '/openwakeword/models/embedding_model.onnx',
          vadModelPath: '/openwakeword/models/silero_vad.onnx',
          vadThreshold: 0.5,
          inferenceFramework: 'onnx',
          wasmPaths: '/openwakeword/ort/',
        });
        await this.model.init();
        console.info('Initialized with custom hey_jarvis model');
      } catch (initErr) {
        console.warn('Custom model initialization failed, attempting fallback...', initErr);

        // Fallback: use a bundled model from openwakeword-js npm package
        this.model = new Model({
          wakewordModels: ['hello_deepa'],  // Built-in model name
          melspectrogramModelPath: '/openwakeword/models/melspectrogram.onnx',
          embeddingModelPath: '/openwakeword/models/embedding_model.onnx',
          vadThreshold: 0.5,
          inferenceFramework: 'onnx',
          wasmPaths: '/openwakeword/ort/',
        });
        await this.model.init();
        console.info('Initialized with fallback hello_deepa model');
      }

      this._ready.set(true);
    } catch (e: any) {
      this._error.set(`Wakeword init failed: ${e?.message ?? e}`);
      console.error('Wakeword initialization error:', e);
    }
  }

  async start(config: WakewordConfig = {}): Promise<void> {
    if (!this._ready()) await this.init();
    if (this.isRunning) return;

    const threshold = config.threshold ?? 0.5;
    const cooldownMs = config.cooldownMs ?? 2000;
    let lastDetectedAt = 0;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Worklet to convert Float32 chunks to 1280-sample frames
      await this.audioContext.audioWorklet.addModule('/wakeword-worklet.js');
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'wakeword-processor');
      source.connect(this.workletNode);

      this.workletNode.port.onmessage = async (event) => {
        const chunk: Float32Array = event.data;
        try {
          const scores = await this.model!.predict(chunk);
          for (const [, rawScore] of Object.entries(scores as Record<string, number>)) {
            const score = Number(rawScore);
            if (score > threshold) {
              const now = Date.now();
              if (now - lastDetectedAt > cooldownMs) {
                lastDetectedAt = now;
                this.zone.run(() => this.detected$.next({ score, timestamp: now }));
              }
            }
          }
        } catch (e) {
          console.error('Wakeword predict error', e);
        }
      };

      this.isRunning = true;
      this._listening.set(true);
    } catch (e: any) {
      this._error.set(`Wakeword start failed: ${e?.message ?? e}`);
      this._listening.set(false);
      throw e;
    }
  }

  stop(): void {
    this.workletNode?.disconnect();
    this.audioContext?.close().catch(() => {});
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.audioContext = null;
    this.mediaStream = null;
    this.workletNode = null;
    this.isRunning = false;
    this._listening.set(false);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
