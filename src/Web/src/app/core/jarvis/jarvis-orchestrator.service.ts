import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { MediaRecorderService } from '../audio/media-recorder.service';
import { AudioPlaybackService } from '../audio/audio-playback.service';
import { JarvisApiService } from '../api/jarvis-api.service';
import { JarvisSignalRService, JarvisStatusUpdate } from './jarvis-signalr.service';

export type JarvisStatus = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'error';

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  audio?: Blob;
}

/**
 * Top-level orchestrator. Subscribes to WakewordService.detected$,
 * then runs the full pipeline: record → transcribe → chat → speak.
 */
@Injectable({ providedIn: 'root' })
export class JarvisOrchestratorService {
  private readonly recorder = inject(MediaRecorderService);
  private readonly playback = inject(AudioPlaybackService);
  private readonly api = inject(JarvisApiService);
  private readonly signalr = inject(JarvisSignalRService);

  private readonly _status = signal<JarvisStatus>('idle');
  private readonly _statusMessage = signal<string>('Bereit');
  private readonly _transcript = signal<TranscriptEntry[]>([]);
  private readonly _interimAnswer = signal<string>('');
  private readonly _currentlyPlaying = signal<TranscriptEntry | null>(null);

  readonly status = this._status.asReadonly();
  readonly statusMessage = this._statusMessage.asReadonly();
  readonly transcript = this._transcript.asReadonly();
  readonly interimAnswer = this._interimAnswer.asReadonly();
  readonly currentlyPlaying = this._currentlyPlaying.asReadonly();

  /** Emits when the full pipeline finishes with an error. */
  readonly errors$ = new Subject<string>();

  init(): void {
    this.signalr.status$.subscribe((update: JarvisStatusUpdate) => {
      this._status.set(update.status as JarvisStatus);
      this._statusMessage.set(update.message);
    });
  }

  setStatus(status: JarvisStatus, message: string): void {
    this._status.set(status);
    this._statusMessage.set(message);
  }

  async handleUserAudio(audio: Blob, voiceId?: string): Promise<void> {
    try {
      this.stopPlayback();
      this.setStatus('transcribing', 'Transkribiere...');
      const result = await this.api.transcribe(audio).toPromise();
      const question = result?.text ?? '';
      if (!question.trim()) {
        this.setStatus('idle', 'Keine Sprache erkannt');
        return;
      }
      this.appendTranscript('user', question);
      await this.handleQuestion(question, voiceId);
    } catch (e: any) {
      this.failWith(e);
    }
  }

  async handleQuestion(question: string, voiceId?: string): Promise<void> {
    try {
      this.stopPlayback();
      this.setStatus('thinking', 'Denke nach...');
      this._interimAnswer.set('');

      let full = '';
      await new Promise<void>((resolve, reject) => {
        this.api.streamChat(question).subscribe({
          next: (chunk) => {
            full += chunk.text;
            this._interimAnswer.set(full);
          },
          error: (e) => reject(e),
          complete: () => resolve(),
        });
      });

      const entry = this.appendTranscript('assistant', full);
      this._interimAnswer.set('');

      this.setStatus('speaking', 'Generiere Sprache...');
      const audio = await this.api.speak({ text: full, voiceId: voiceId || undefined }).toPromise();
      if (audio) {
        entry.audio = audio;
        await this.playback.play(audio);
      }

      this.setStatus('idle', 'Bereit');
    } catch (e: any) {
      this.failWith(e);
    }
  }

  async playResponse(entry: TranscriptEntry, voiceId?: string): Promise<void> {
    if (this._currentlyPlaying() === entry) {
      this.stopPlayback();
      return;
    }

    this.stopPlayback();

    try {
      this._currentlyPlaying.set(entry);
      
      let audio = entry.audio;
      if (!audio) {
        this.setStatus('speaking', 'Generiere Sprache...');
        audio = await this.api.speak({ text: entry.text, voiceId: voiceId || undefined }).toPromise();
        if (audio) {
          entry.audio = audio;
        }
      }

      if (audio) {
        this.setStatus('speaking', 'Spiele Antwort ab...');
        await this.playback.play(audio);
      }
    } catch (e: any) {
      this.failWith(e);
    } finally {
      if (this._currentlyPlaying() === entry) {
        this._currentlyPlaying.set(null);
        this.setStatus('idle', 'Bereit');
      }
    }
  }

  stopPlayback(): void {
    this.playback.stop();
    this._currentlyPlaying.set(null);
    if (this.status() === 'speaking') {
      this.setStatus('idle', 'Bereit');
    }
  }

  appendTranscript(role: 'user' | 'assistant', text: string): TranscriptEntry {
    const entry: TranscriptEntry = { role, text, timestamp: new Date() };
    this._transcript.update(t => [...t, entry]);
    return entry;
  }

  clearTranscript(): void {
    this.stopPlayback();
    this._transcript.set([]);
  }

  private failWith(e: any): void {
    console.error('Pipeline error', e);
    const msg = e?.message ?? String(e);
    this.setStatus('error', msg);
    this.errors$.next(msg);
  }
}
