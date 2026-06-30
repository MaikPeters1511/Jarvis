import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { WakewordService } from '../../core/wakeword/wakeword.service';
import { MediaRecorderService } from '../../core/audio/media-recorder.service';
import { JarvisApiService, Settings } from '../../core/api/jarvis-api.service';
import { JarvisOrchestratorService, JarvisStatus } from '../../core/jarvis/jarvis-orchestrator.service';
import { JarvisSignalRService } from '../../core/jarvis/jarvis-signalr.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-chat',
  imports: [],
  template: `
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-4 md:p-8 max-w-7xl mx-auto w-full min-h-0">
      <!-- Left Column: Status, Orb, Controls -->
      <div class="lg:col-span-5 flex flex-col items-center justify-between gap-6 glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden">
        <!-- Subtle background glow -->
        <div class="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-secondary/10 blur-3xl pointer-events-none"></div>

        <div class="w-full flex flex-col items-center gap-2">
          <div class="badge badge-outline badge-sm uppercase tracking-widest opacity-60 mb-2">Jarvis Core</div>
          
          <!-- Animated Status Orb -->
          <div class="jarvis-orb-container" [attr.data-status]="orchestrator.status()">
            <div class="orb-ring ring-1"></div>
            <div class="orb-ring ring-2"></div>
            <div class="orb-ring ring-3"></div>
            <div class="orb-core">
              @switch (orchestrator.status()) {
                @case ('idle') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-primary transition-all duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                }
                @case ('listening') {
                  <div class="voice-waves">
                    <span></span><span></span><span></span><span></span><span></span>
                  </div>
                }
                @case ('transcribing') {
                  <svg class="animate-spin w-8 h-8 text-info" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                }
                @case ('thinking') {
                  <span class="text-3xl animate-pulse">🧠</span>
                }
                @case ('speaking') {
                  <div class="voice-waves">
                    <span class="bg-warning"></span><span class="bg-warning"></span><span class="bg-warning"></span><span class="bg-warning"></span><span class="bg-warning"></span>
                  </div>
                }
                @case ('error') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-error animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                }
              }
            </div>
          </div>

          <div class="text-center mt-2">
            <h2 class="text-xl font-bold tracking-tight glow-text">{{ orchestrator.statusMessage() }}</h2>
            <p class="text-xs opacity-50 mt-1">Status: {{ orchestrator.status() }}</p>
          </div>
        </div>

        <!-- Controls -->
        <div class="w-full flex flex-col gap-4 mt-4">
          <!-- Wake-word status -->
          <div class="bg-base-300/50 rounded-2xl p-4 flex items-center justify-between border border-base-content/5">
            <div class="flex-1 pr-3">
              <h3 class="text-sm font-semibold">Wake-Word Erkennung</h3>
              <p class="text-xs opacity-60 mt-0.5">
                @if (wakeword.error()) {
                  Fehler: {{ wakeword.error() }}
                } @else if (wakeword.listening()) {
                  Hört auf "<strong>javis</strong>"
                } @else if (wakeword.ready()) {
                  Bereit zur Aktivierung
                } @else {
                  Nicht initialisiert
                }
              </p>
            </div>
            <input
              type="checkbox"
              class="toggle toggle-primary toggle-md"
              [checked]="wakeword.listening()"
              (change)="toggleWakeword()"
            [disabled]="!wakeword.ready() && !wakeword.error()"
              aria-label="Wake-Word aktivieren" />
          </div>

          <!-- Manual triggers -->
          <div class="flex gap-2 w-full">
            <button class="btn btn-primary flex-1 shadow-lg hover:shadow-primary/20 transition-all duration-300" 
                    (click)="recordManual()" 
                    [disabled]="orchestrator.status() !== 'idle'">
              <span class="text-lg">🎤</span> Frage stellen
            </button>
            <button class="btn btn-outline btn-ghost border-base-content/10" 
                    (click)="orchestrator.clearTranscript()" 
                    [disabled]="orchestrator.transcript().length === 0">
              Verlauf leeren
            </button>
          </div>
        </div>
      </div>

      <!-- Right Column: Chat History -->
      <div class="lg:col-span-7 flex flex-col glass-card rounded-3xl overflow-hidden h-[600px] lg:h-auto min-h-0">
        <!-- Chat header -->
        <div class="p-4 border-b border-base-content/5 flex items-center justify-between bg-base-300/30">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-success animate-pulse"></div>
            <h3 class="font-bold text-sm tracking-wide uppercase opacity-75">Konversation</h3>
          </div>
          <span class="text-xs opacity-50">{{ orchestrator.transcript().length }} Nachrichten</span>
        </div>

        <!-- Chat messages area -->
        <div class="flex-1 p-4 md:p-6 overflow-y-auto min-h-0 flex flex-col gap-4">
          @if (orchestrator.transcript().length === 0 && !orchestrator.interimAnswer()) {
            <div class="flex-1 flex flex-col items-center justify-center text-center opacity-40 p-8">
              <div class="w-16 h-16 rounded-full border border-dashed border-base-content/20 flex items-center justify-center mb-4 text-2xl">💬</div>
              <p class="font-medium text-sm">Kein Gesprächsverlauf vorhanden</p>
              <p class="text-xs max-w-xs mt-1">Schnittstelle bereit. Klicke auf "Frage stellen" oder sage das Wake-Word "javis".</p>
            </div>
          } @else {
            <div class="flex flex-col gap-4">
              @for (entry of orchestrator.transcript(); track entry.timestamp) {
                <div [class]="entry.role === 'user' ? 'chat chat-end' : 'chat chat-start'">
                  <div class="chat-image avatar">
                    <div class="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-sm border border-base-content/10">
                      {{ entry.role === 'user' ? '👤' : '🤖' }}
                    </div>
                  </div>
                  <div class="chat-header text-xs opacity-50 mb-1 px-1">
                    {{ entry.role === 'user' ? 'Du' : 'Javis' }}
                  </div>
                  <div [class]="entry.role === 'user' ? 'chat-bubble chat-bubble-primary' : 'chat-bubble relative pr-10'">
                    <div>{{ entry.text }}</div>
                    @if (entry.role === 'assistant') {
                      <button 
                        class="absolute right-2 top-2 btn btn-circle btn-xs btn-ghost transition-all duration-200"
                        (click)="orchestrator.playResponse(entry, selectedVoiceId)"
                        [title]="orchestrator.currentlyPlaying() === entry ? 'Wiedergabe stoppen' : 'Antwort abspielen'">
                        @if (orchestrator.currentlyPlaying() === entry) {
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 fill-current text-primary animate-pulse" viewBox="0 0 24 24"><path d="M6 19h12V5H6v14z"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 fill-current text-base-content/40 hover:text-primary" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        }
                      </button>
                    }
                  </div>
                </div>
              }
              @if (orchestrator.interimAnswer()) {
                <div class="chat chat-start">
                  <div class="chat-image avatar">
                    <div class="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-sm border border-base-content/10">
                      🤖
                    </div>
                  </div>
                  <div class="chat-header text-xs opacity-50 mb-1 px-1">Javis</div>
                  <div class="chat-bubble chat-bubble-ghost border border-base-content/5 bg-base-200/50 backdrop-blur">
                    {{ orchestrator.interimAnswer() }}
                    <span class="loading loading-dots loading-xs ml-1 align-middle"></span>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ChatComponent implements OnInit, OnDestroy {
  readonly wakeword = inject(WakewordService);
  readonly recorder = inject(MediaRecorderService);
  readonly api = inject(JarvisApiService);
  readonly orchestrator = inject(JarvisOrchestratorService);
  readonly signalr = inject(JarvisSignalRService);

  private destroy$ = new Subject<void>();
  selectedVoiceId = '';
  settings: Settings = {};

  async ngOnInit(): Promise<void> {
    this.orchestrator.init();
    this.signalr.connect();
    void this.wakeword.init();

    // Load default voice
    try {
      const [voices, settings] = await Promise.all([
        firstValueFrom(this.api.listVoices()),
        firstValueFrom(this.api.getSettings()),
      ]);
      this.settings = settings;
      const defaultVoiceId = settings['tts.default_voice_id'];
      const def = voices.find(v => v.id === defaultVoiceId) ?? voices[0];
      if (def) this.selectedVoiceId = def.id;
    } catch (e) {
      console.warn('Could not load voices or settings', e);
    }

    // Subscribe to wake-word detection
    this.wakeword.detected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ score }) => {
        console.log('Wake word detected', score);
        this.runVoiceCapture();
      });
  }

  async toggleWakeword(): Promise<void> {
    if (this.wakeword.listening()) {
      this.wakeword.stop();
      return;
    }

    try {
      await this.wakeword.init();
      await this.wakeword.start();
    } catch (e) {
      console.error('Wakeword start failed', e);
    }
  }

  async recordManual(): Promise<void> {
    if (this.orchestrator.status() !== 'idle') return;
    await this.runVoiceCapture();
  }

  private async runVoiceCapture(): Promise<void> {
    this.orchestrator.setStatus('listening', 'Spreche jetzt...');
    try {
      const silenceMs = this.settings['stt.silence_ms'] ? parseInt(this.settings['stt.silence_ms'], 10) : 1500;
      const silenceThreshold = this.settings['stt.silence_threshold'] ? parseFloat(this.settings['stt.silence_threshold']) : 0.015;

      const blob = await firstValueFrom(this.recorder.start({
        silenceMs,
        silenceThreshold,
        maxDurationMs: 30000
      }));
      if (blob.size > 0) {
        await this.orchestrator.handleUserAudio(blob, this.selectedVoiceId);
      }
    } catch (e) {
      console.error('Recording error', e);
      this.orchestrator.setStatus('error', String(e));
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wakeword.stop();
  }
}
