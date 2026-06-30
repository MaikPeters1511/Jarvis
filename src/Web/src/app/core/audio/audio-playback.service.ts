import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioPlaybackService {
  private currentAudio: HTMLAudioElement | null = null;
  readonly isPlaying = signal<boolean>(false);

  /**
   * Play a Blob (wav, webm, mp3) and return when finished.
   */
  async play(blob: Blob): Promise<void> {
    this.stop();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    this.currentAudio = audio;
    this.isPlaying.set(true);
    try {
      await audio.play();
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onpause = () => resolve();
        audio.onerror = (e) => reject(new Error('Audio playback error'));
      });
    } finally {
      URL.revokeObjectURL(url);
      this.currentAudio = null;
      this.isPlaying.set(false);
    }
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }
}
