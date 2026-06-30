import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { getApiBaseUrl } from './api-base-url.interceptor';

export interface Voice {
  id: string;
  name: string;
  language: string;
  ref_text: string;
  filename: string;
  size_bytes: number;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface Settings {
  [key: string]: string | undefined;
}

export interface SpeakRequest {
  text: string;
  voiceId?: string;
  language?: string;
}

@Injectable({ providedIn: 'root' })
export class JarvisApiService {
  private readonly http = inject(HttpClient);

  // ── Transcribe ────────────────────────────────────────────────────────
  transcribe(audio: Blob): Observable<{ text: string }> {
    const fd = new FormData();
    fd.append('audio', audio, 'recording.wav');
    return this.http.post<{ text: string }>('/api/transcribe', fd);
  }

  // ── Chat (SSE) ────────────────────────────────────────────────────────
  streamChat(text: string, systemPromptOverride?: string): Observable<ChatChunk> {
    const apiBase = getApiBaseUrl();
    return new Observable<ChatChunk>(observer => {
      const controller = new AbortController();
      fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, systemPromptOverride }),
        signal: controller.signal,
      }).then(async res => {
        if (!res.ok || !res.body) {
          observer.error(new Error(`Chat failed: ${res.status}`));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const data = JSON.parse(line.slice(5).trim());
                  observer.next(data as ChatChunk);
                } catch {}
              }
            }
          }
          observer.complete();
        } catch (err) {
          observer.error(err);
        }
      }).catch(err => observer.error(err));

      return () => controller.abort();
    });
  }

  // ── Full pipeline (audio in → audio out) ──────────────────────────────
  pipeline(audio: Blob, voiceId?: string): Observable<Blob> {
    const apiBase = getApiBaseUrl();
    const fd = new FormData();
    fd.append('audio', audio, 'recording.wav');
    if (voiceId) fd.append('voiceId', voiceId);
    return new Observable<Blob>(observer => {
      const controller = new AbortController();
      fetch(`${apiBase}/api/pipeline`, {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      }).then(async res => {
        if (!res.ok) {
          observer.error(new Error(`Pipeline failed: ${res.status}`));
          return;
        }
        const blob = await res.blob();
        observer.next(blob);
        observer.complete();
      }).catch(err => observer.error(err));
      return () => controller.abort();
    });
  }

  // ── Speak (TTS) ───────────────────────────────────────────────────────
  speak(req: SpeakRequest): Observable<Blob> {
    const apiBase = getApiBaseUrl();
    return new Observable<Blob>(observer => {
      const controller = new AbortController();
      fetch(`${apiBase}/api/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: controller.signal,
      }).then(async res => {
        if (!res.ok) {
          observer.error(new Error(`Speak failed: ${res.status}`));
          return;
        }
        const blob = await res.blob();
        observer.next(blob);
        observer.complete();
      }).catch(err => observer.error(err));
      return () => controller.abort();
    });
  }

  // ── Voices ────────────────────────────────────────────────────────────
  listVoices(): Observable<Voice[]> {
    return this.http.get<Voice[]>('/api/voices');
  }

  uploadVoice(name: string, refText: string, language: string, audio: File): Observable<Voice> {
    const fd = new FormData();
    fd.append('name', name);
    fd.append('refText', refText);
    fd.append('language', language);
    fd.append('file', audio);
    return this.http.post<Voice>('/api/voices', fd);
  }

  deleteVoice(id: string): Observable<void> {
    return this.http.delete<void>(`/api/voices/${id}`);
  }

  // ── Settings ──────────────────────────────────────────────────────────
  getSettings(): Observable<Settings> {
    return this.http.get<Settings>('/api/settings');
  }

  updateSetting(key: string, value: string): Observable<{ key: string; value: string }> {
    return this.http.put<{ key: string; value: string }>(`/api/settings/${key}`, { value });
  }

  updateSettings(updates: Settings): Observable<Settings> {
    return this.http.put<Settings>('/api/settings', updates);
  }
}

export interface ChatChunk {
  text: string;
}
