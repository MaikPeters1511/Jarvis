import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface RecorderOptions {
  /** Stop automatically when silence is detected for this many ms. */
  silenceMs?: number;
  /** RMS threshold below which audio is considered silence (0..1). */
  silenceThreshold?: number;
  /** Hard maximum recording duration in ms. */
  maxDurationMs?: number;
  /** MIME type - unused in WAV recording but kept for interface compatibility. */
  mimeType?: string;
}

/**
 * Service that records audio from the user's microphone,
 * detects silence using Web Audio API, and encodes the raw
 * PCM data directly into a 16kHz Mono 16-bit WAV file.
 */
@Injectable({ providedIn: 'root' })
export class MediaRecorderService {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private audioBuffers: Float32Array[] = [];
  private silenceCheckInterval: any = null;
  private maxTimeout: any = null;
  private startedAt = 0;
  private lastLoudAt = 0;
  private currentSubject: Subject<Blob> | null = null;

  /**
   * Start recording and return an Observable that emits the final WAV Blob.
   */
  start(options: RecorderOptions = {}): Observable<Blob> {
    this.currentSubject = new Subject<Blob>();
    const silenceMs = options.silenceMs ?? 1500;
    const silenceThreshold = options.silenceThreshold ?? 0.015;
    const maxDurationMs = options.maxDurationMs ?? 30000;

    (async () => {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
        });

        // Create AudioContext forced at 16000Hz (browser will handle downsampling)
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(this.stream);

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 1024;
        source.connect(this.analyser);

        this.audioBuffers = [];
        this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.scriptProcessor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          this.audioBuffers.push(new Float32Array(inputData));
        };

        source.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);

        this.startedAt = Date.now();
        this.lastLoudAt = this.startedAt;

        this.silenceCheckInterval = setInterval(() => {
          if (!this.analyser) return;
          const rms = this.getRMS();
          if (rms > silenceThreshold) this.lastLoudAt = Date.now();
          if (Date.now() - this.lastLoudAt > silenceMs) {
            if (this.currentSubject) this.stopWithWav(this.currentSubject);
          }
        }, 100);

        this.maxTimeout = setTimeout(() => {
          if (this.currentSubject) this.stopWithWav(this.currentSubject);
        }, maxDurationMs);
      } catch (e) {
        if (this.currentSubject) {
          this.currentSubject.error(e);
        }
        this.cleanup();
      }
    })();

    return this.currentSubject.asObservable();
  }

  stop(): void {
    if (this.currentSubject) {
      this.stopWithWav(this.currentSubject);
    } else {
      this.cleanup();
    }
  }

  /** Current audio level (0..1) for visualisation. */
  getLevel(): number {
    return this.getRMS();
  }

  private getRMS(): number {
    if (!this.analyser) return 0;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    return Math.sqrt(sum / buf.length);
  }

  private stopWithWav(subject: Subject<Blob>): void {
    this.currentSubject = null;

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }

    const wavBlob = this.encodeWav(this.audioBuffers, 16000);
    subject.next(wavBlob);
    subject.complete();
    this.cleanup();
  }

  private cleanup(): void {
    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }
    if (this.maxTimeout) {
      clearTimeout(this.maxTimeout);
      this.maxTimeout = null;
    }
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close().catch(() => {});
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.audioBuffers = [];
  }

  private encodeWav(buffers: Float32Array[], sampleRate: number): Blob {
    // 1. Calculate total length of samples
    let totalLength = 0;
    for (const b of buffers) {
      totalLength += b.length;
    }

    // 2. Merge all buffers into one Float32Array
    const mergedBuffer = new Float32Array(totalLength);
    let offset = 0;
    for (const b of buffers) {
      mergedBuffer.set(b, offset);
      offset += b.length;
    }

    // 3. Create ArrayBuffer for WAV file
    const buffer = new ArrayBuffer(44 + totalLength * 2);
    const view = new DataView(buffer);

    // 4. Write WAV header helper
    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    const byteRate = (sampleRate * 1 * 16) / 8; // sampleRate * numChannels * bytesPerSample
    const blockAlign = 2; // numChannels * bytesPerSample
    const subChunk2Size = totalLength * 2;
    const chunkSize = 36 + subChunk2Size;

    writeString(view, 0, 'RIFF');
    view.setUint32(4, chunkSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, 1, true); // NumChannels (1 = Mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // BitsPerSample
    writeString(view, 36, 'data');
    view.setUint32(40, subChunk2Size, true);

    // 5. Convert Float32 samples to Int16 PCM samples
    let index = 44;
    for (let i = 0; i < totalLength; i++) {
      let s = Math.max(-1, Math.min(1, mergedBuffer[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      index += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }
}
