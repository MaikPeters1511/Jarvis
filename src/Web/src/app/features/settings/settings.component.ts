import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JarvisApiService, Voice, Settings } from '../../core/api/jarvis-api.service';
import { ThemeService } from '../../core/theme/theme.service';
import { firstValueFrom } from 'rxjs';

type Tab = 'voice' | 'llm' | 'wake' | 'stt' | 'appearance';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  template: `
    <div class="container mx-auto p-4 md:p-8 max-w-5xl">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight glow-text bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Einstellungen</h1>
          <p class="text-sm opacity-60 mt-1">Konfiguriere deinen Sprachassistenten Javis nach deinen Wünschen.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <!-- Sidebar Navigation (Tabs) -->
        <div class="md:col-span-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
          @for (t of tabsList; track t.id) {
            <button 
              (click)="tab.set(t.id)" 
              class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap md:w-full"
              [class.bg-primary]="tab() === t.id"
              [class.text-primary-content]="tab() === t.id"
              [class.glass-card]="tab() !== t.id"
              [class.hover:bg-base-200]="tab() !== t.id"
            >
              <span>{{ t.icon }}</span>
              <span>{{ t.label }}</span>
            </button>
          }
        </div>

        <!-- Settings Content Panel -->
        <div class="md:col-span-9 glass-card p-6 md:p-8 rounded-3xl min-h-[450px]">
          @switch (tab()) {
            @case ('voice') {
              <div class="flex flex-col gap-6">
                <div>
                  <h2 class="text-xl font-bold mb-1">Referenz-Stimme für Voice Cloning</h2>
                  <p class="text-xs opacity-60">Lade eine Audio-Datei hoch (3+ Sek., WAV/MP3), damit Qwen3-TTS deine Stimme klonen kann.</p>
                </div>

                <!-- Voice Upload Area -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" placeholder="Name (z.B. 'Meine Stimme')" class="input input-bordered w-full glass-card border-base-content/10 focus:border-primary"
                         [(ngModel)]="newVoice.name" />
                  <input type="text" placeholder="Sprache (Auto/German/English)" class="input input-bordered w-full glass-card border-base-content/10 focus:border-primary"
                         [(ngModel)]="newVoice.language" />
                  <label class="btn btn-outline btn-primary glass-card border-primary/20 hover:border-primary cursor-pointer">
                    📁 Datei wählen
                    <input type="file" accept="audio/*" class="hidden" (change)="onFileSelected($event)" />
                  </label>
                </div>

                <textarea placeholder="Gib hier den exakten gesprochenen Text der Audiodatei ein..." class="textarea textarea-bordered w-full h-20 glass-card border-base-content/10 focus:border-primary"
                          [(ngModel)]="newVoice.refText"></textarea>

                @if (newVoice.file) {
                  <div class="flex items-center justify-between p-3 bg-success/10 text-success rounded-xl border border-success/20 text-xs">
                    <span class="font-medium">Selected file: {{ newVoice.file.name }}</span>
                    <span>{{ (newVoice.file.size / 1024).toFixed(1) }} KB</span>
                  </div>
                }

                <button class="btn btn-primary w-full shadow-lg hover:shadow-primary/20 transition-all duration-300" 
                        (click)="uploadVoice()"
                        [disabled]="!canUpload() || uploading()">
                  @if (uploading()) { <span class="loading loading-spinner loading-xs"></span> }
                  Stimme hochladen & klonen
                </button>

                <div class="divider opacity-50"></div>

                <!-- Uploaded Voices List -->
                <div>
                  <h3 class="font-bold text-sm tracking-wide uppercase opacity-75 mb-3">Verfügbare Stimmen</h3>
                  @if (voices().length === 0) {
                    <p class="opacity-40 text-xs text-center py-6 border border-dashed border-base-content/20 rounded-2xl">Noch keine Stimmen hochgeladen.</p>
                  } @else {
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      @for (voice of voices(); track voice.id) {
                        <div class="p-4 bg-base-300/40 rounded-2xl border border-base-content/5 flex flex-col justify-between gap-3">
                          <div>
                            <div class="font-bold text-sm flex items-center gap-2">
                              <span>{{ voice.name }}</span>
                              @if (settings()['tts.default_voice_id'] === voice.id) {
                                <span class="badge badge-primary badge-xs">Standard</span>
                              }
                            </div>
                            <div class="text-[10px] opacity-60 mt-1">
                              {{ voice.language }} · {{ (voice.size_bytes / 1024).toFixed(1) }} KB
                            </div>
                          </div>
                          <div class="flex gap-2">
                            @if (settings()['tts.default_voice_id'] !== voice.id) {
                              <button class="btn btn-xs btn-outline btn-ghost flex-1 text-[10px]" (click)="setDefault(voice.id)">Standard</button>
                            }
                            <button class="btn btn-xs btn-error btn-outline flex-1 text-[10px]" (click)="deleteVoice(voice)">Löschen</button>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>

                <div class="divider opacity-50"></div>

                <!-- TTS Parameters -->
                <div>
                  <h3 class="font-bold text-sm tracking-wide uppercase opacity-75 mb-4">TTS-Synthese Parameter</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label class="form-control">
                      <div class="label pb-1">
                        <span class="label-text font-medium text-xs">Temperatur</span>
                        <span class="badge badge-outline badge-xs">{{ settings()['tts.temperature'] ?? '0.9' }}</span>
                      </div>
                      <input type="range" min="0.1" max="1.5" step="0.05"
                             class="range range-primary range-xs"
                             [ngModel]="settings()['tts.temperature']"
                             (ngModelChange)="setSetting('tts.temperature', $event)" />
                    </label>
                    <label class="form-control">
                      <div class="label pb-1">
                        <span class="label-text font-medium text-xs">Top-P</span>
                        <span class="badge badge-outline badge-xs">{{ settings()['tts.top_p'] ?? '1.0' }}</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.05"
                             class="range range-primary range-xs"
                             [ngModel]="settings()['tts.top_p']"
                             (ngModelChange)="setSetting('tts.top_p', $event)" />
                    </label>
                    <label class="form-control">
                      <div class="label pb-1">
                        <span class="label-text font-medium text-xs">Top-K</span>
                        <span class="badge badge-outline badge-xs">{{ settings()['tts.top_k'] ?? '50' }}</span>
                      </div>
                      <input type="range" min="0" max="200" step="1"
                             class="range range-primary range-xs"
                             [ngModel]="settings()['tts.top_k']"
                             (ngModelChange)="setSetting('tts.top_k', $event)" />
                    </label>
                    <label class="form-control">
                      <div class="label pb-1">
                        <span class="label-text font-medium text-xs">Repetition Penalty</span>
                        <span class="badge badge-outline badge-xs">{{ settings()['tts.repetition_penalty'] ?? '1.05' }}</span>
                      </div>
                      <input type="range" min="1.0" max="2.0" step="0.05"
                             class="range range-primary range-xs"
                             [ngModel]="settings()['tts.repetition_penalty']"
                             (ngModelChange)="setSetting('tts.repetition_penalty', $event)" />
                    </label>
                    <label class="form-control md:col-span-2">
                      <span class="label-text font-medium text-xs mb-1">Synthese Zielsprache</span>
                      <select class="select select-bordered select-sm w-full glass-card border-base-content/10"
                              [ngModel]="settings()['tts.language']"
                              (ngModelChange)="setSetting('tts.language', $event)">
                        <option>Auto</option>
                        <option>English</option>
                        <option>German</option>
                        <option>Chinese</option>
                        <option>Japanese</option>
                        <option>French</option>
                        <option>Spanish</option>
                        <option>Italian</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            }

            @case ('llm') {
              <div class="flex flex-col gap-6">
                <div>
                  <h2 class="text-xl font-bold mb-1">LLM-Einstellungen (Gemma 3 12B)</h2>
                  <p class="text-xs opacity-60">Passe das Verhalten, die Prompt-Struktur und die Parameter des lokalen Sprachmodells an.</p>
                </div>

                <label class="form-control">
                  <span class="label-text font-semibold text-xs mb-2">System-Prompt</span>
                  <textarea class="textarea textarea-bordered h-32 glass-card border-base-content/10 focus:border-primary text-sm leading-relaxed"
                            [ngModel]="settings()['llm.system_prompt']"
                            (ngModelChange)="setSetting('llm.system_prompt', $event)"></textarea>
                </label>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  <label class="form-control">
                    <div class="label pb-1">
                      <span class="label-text font-medium text-xs">Temperatur</span>
                      <span class="badge badge-outline badge-xs">{{ settings()['llm.temperature'] ?? '0.7' }}</span>
                    </div>
                    <input type="range" min="0" max="2" step="0.05"
                           class="range range-primary range-xs"
                           [ngModel]="settings()['llm.temperature']"
                           (ngModelChange)="setSetting('llm.temperature', $event)" />
                  </label>
                  <label class="form-control">
                    <div class="label pb-1">
                      <span class="label-text font-medium text-xs">Top-P</span>
                      <span class="badge badge-outline badge-xs">{{ settings()['llm.top_p'] ?? '0.9' }}</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05"
                           class="range range-primary range-xs"
                           [ngModel]="settings()['llm.top_p']"
                           (ngModelChange)="setSetting('llm.top_p', $event)" />
                  </label>
                  <label class="form-control md:col-span-2">
                    <div class="label pb-1">
                      <span class="label-text font-medium text-xs">Maximale Tokens</span>
                      <span class="badge badge-outline badge-xs">{{ settings()['llm.max_tokens'] ?? '512' }}</span>
                    </div>
                    <input type="range" min="64" max="4096" step="32"
                           class="range range-primary range-xs"
                           [ngModel]="settings()['llm.max_tokens']"
                           (ngModelChange)="setSetting('llm.max_tokens', $event)" />
                  </label>
                </div>
              </div>
            }

            @case ('stt') {
              <div class="flex flex-col gap-6">
                <div>
                  <h2 class="text-xl font-bold mb-1">Speech-to-Text (Whisper Base)</h2>
                  <p class="text-xs opacity-60">Passe die Spracherkennung und Stille-Erkennung an, falls du zu schnell abgeschnitten wirst oder Javis dich nicht versteht.</p>
                </div>

                <div class="flex flex-col gap-4">
                  <label class="form-control max-w-sm">
                    <span class="label-text font-semibold text-xs mb-2">Erkennungssprache</span>
                    <select class="select select-bordered select-sm w-full glass-card border-base-content/10"
                            [ngModel]="settings()['stt.language']"
                            (ngModelChange)="setSetting('stt.language', $event)">
                      <option value="auto">Auto-Erkennung (Erkennungsfehler möglich)</option>
                      <option value="de">Deutsch (German) - Empfohlen für Deutsch</option>
                      <option value="en">Englisch (English)</option>
                      <option value="fr">Französisch (French)</option>
                      <option value="es">Spanisch (Spanish)</option>
                    </select>
                    <div class="label pt-1">
                      <span class="label-text-alt opacity-50">Tipp: Wähle fest "Deutsch", um falsche Erkennungssprachen zu vermeiden.</span>
                    </div>
                  </label>

                  <div class="divider opacity-30 my-1"></div>

                  <h3 class="font-bold text-sm tracking-wide uppercase opacity-75">Stille-Erkennung (Automatischer Stopp)</h3>
                  
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <label class="form-control">
                      <div class="label pb-1">
                        <span class="label-text font-medium text-xs">Schweigezeit-Grenze</span>
                        <span class="badge badge-outline badge-xs">{{ settings()['stt.silence_ms'] ?? '1500' }} ms</span>
                      </div>
                      <input type="range" min="500" max="5000" step="100"
                             class="range range-primary range-xs"
                             [ngModel]="settings()['stt.silence_ms']"
                             (ngModelChange)="setSetting('stt.silence_ms', $event)" />
                      <div class="label pt-1">
                        <span class="label-text-alt opacity-50">Zeitraum in Millisekunden, nach dem die Aufnahme bei Stille stoppt.</span>
                      </div>
                    </label>

                    <label class="form-control">
                      <div class="label pb-1">
                        <span class="label-text font-medium text-xs">Mindestlautstärke (Schwellenwert)</span>
                        <span class="badge badge-outline badge-xs">{{ settings()['stt.silence_threshold'] ?? '0.015' }}</span>
                      </div>
                      <input type="range" min="0.001" max="0.05" step="0.001"
                             class="range range-primary range-xs"
                             [ngModel]="settings()['stt.silence_threshold']"
                             (ngModelChange)="setSetting('stt.silence_threshold', $event)" />
                      <div class="label pt-1">
                        <span class="label-text-alt opacity-50">Niedrigere Werte verhindern, dass die Aufnahme bei leisem Sprechen stoppt.</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            }

            @case ('wake') {
              <div class="flex flex-col gap-6">
                <div>
                  <h2 class="text-xl font-bold mb-1">Wake-Word Erkennung (openWakeWord)</h2>
                  <p class="text-xs opacity-60">Optimiere die Erkennungsempfindlichkeit, wenn du Javis mit deiner Stimme aktivierst.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <label class="form-control">
                    <div class="label pb-1">
                      <span class="label-text font-medium text-xs">Empfindlichkeit (Schwellenwert)</span>
                      <span class="badge badge-outline badge-xs">{{ settings()['wakeword.threshold'] ?? '0.5' }}</span>
                    </div>
                    <input type="range" min="0.1" max="0.9" step="0.05"
                           class="range range-primary"
                           [ngModel]="settings()['wakeword.threshold']"
                           (ngModelChange)="setSetting('wakeword.threshold', $event)" />
                  </label>
                  <label class="form-control">
                    <div class="label pb-1">
                      <span class="label-text font-medium text-xs">Cooldown nach Erkennung</span>
                      <span class="badge badge-outline badge-xs">{{ settings()['wakeword.cooldown_ms'] ?? '2000' }} ms</span>
                    </div>
                    <input type="range" min="500" max="5000" step="100"
                           class="range range-primary"
                           [ngModel]="settings()['wakeword.cooldown_ms']"
                           (ngModelChange)="setSetting('wakeword.cooldown_ms', $event)" />
                  </label>
                </div>

                <div class="alert alert-info bg-info/10 text-info border-info/20 text-xs rounded-2xl flex items-start gap-3 mt-4">
                  <span class="text-lg">ℹ️</span>
                  <div>
                    <span class="font-bold">Eigenes Wake-Word gefällig?</span><br>
                    <span>
                      Trainiere mit dem <a href="https://github.com/dsacms/openWakeWord" target="_blank" class="link font-semibold">openWakeWord Colab Notebook</a> ein eigenes Modell und überschreibe damit <code>public/openwakeword/models/hey_jarvis_v0.1.onnx</code>.
                    </span>
                  </div>
                </div>
              </div>
            }

            @case ('appearance') {
              <div class="flex flex-col gap-6">
                <div>
                  <h2 class="text-xl font-bold mb-1">Farbschema & Design</h2>
                  <p class="text-xs opacity-60">Passe das visuelle Design der Benutzeroberfläche an.</p>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  @for (t of theme.themes; track t) {
                    <button 
                      class="btn btn-sm capitalize transition-all duration-300" 
                      [class.btn-primary]="theme.current() === t" 
                      [class.btn-outline]="theme.current() !== t"
                      [class.border-base-content/10]="theme.current() !== t"
                      (click)="theme.set(t)"
                    >
                      {{ t }}
                    </button>
                  }
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private readonly api = inject(JarvisApiService);
  readonly theme = inject(ThemeService);

  readonly tabsList: { id: Tab; label: string; icon: string }[] = [
    { id: 'voice', label: 'Stimme', icon: '🎙️' },
    { id: 'llm', label: 'LLM (Gemma)', icon: '🧠' },
    { id: 'stt', label: 'STT (Whisper)', icon: '📝' },
    { id: 'wake', label: 'Wake-Word', icon: '👂' },
    { id: 'appearance', label: 'Aussehen', icon: '🎨' }
  ];

  readonly tab = signal<Tab>('voice');
  readonly voices = signal<Voice[]>([]);
  readonly settings = signal<Settings>({});
  readonly uploading = signal(false);

  newVoice = { name: '', refText: '', language: 'Auto', file: null as File | null };

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    try {
      const [voices, settings] = await Promise.all([
        firstValueFrom(this.api.listVoices()),
        firstValueFrom(this.api.getSettings()),
      ]);
      this.voices.set(voices);
      this.settings.set(settings);
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.newVoice.file = input.files[0];
  }

  canUpload(): boolean {
    return !!(this.newVoice.name && this.newVoice.refText && this.newVoice.file);
  }

  async uploadVoice(): Promise<void> {
    if (!this.canUpload() || !this.newVoice.file) return;
    this.uploading.set(true);
    try {
      await firstValueFrom(this.api.uploadVoice(
        this.newVoice.name,
        this.newVoice.refText,
        this.newVoice.language,
        this.newVoice.file,
      ));
      this.newVoice = { name: '', refText: '', language: 'Auto', file: null };
      await this.reload();
    } catch (e) {
      console.error('Upload failed', e);
      alert('Upload fehlgeschlagen: ' + (e as Error).message);
    } finally {
      this.uploading.set(false);
    }
  }

  async deleteVoice(v: Voice): Promise<void> {
    if (!confirm(`Stimme "${v.name}" löschen?`)) return;
    try {
      await firstValueFrom(this.api.deleteVoice(v.id));
      await this.reload();
    } catch (e) {
      console.error('Delete failed', e);
    }
  }

  async setDefault(id: string): Promise<void> {
    await this.setSetting('tts.default_voice_id', id);
  }

  async setSetting(key: string, value: any): Promise<void> {
    const v = String(value);
    this.settings.update(s => ({ ...s, [key]: v }));
    try {
      await firstValueFrom(this.api.updateSetting(key, v));
    } catch (e) {
      console.error(`Failed to save setting ${key}`, e);
    }
  }
}
