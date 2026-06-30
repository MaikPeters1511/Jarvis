import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type ThemeName = 'light' | 'dark' | 'cupcake' | 'dracula' | 'emerald' | 'synthwave' | 'business' | 'valentine';

const STORAGE_KEY = 'javis.theme';
const DEFAULT_THEME: ThemeName = 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly _current = signal<ThemeName>(this.loadInitial());

  readonly current = this._current.asReadonly();
  readonly themes: ThemeName[] = [
    'light', 'dark', 'cupcake', 'dracula', 'emerald', 'synthwave', 'business', 'valentine'
  ];

  constructor() {
    effect(() => {
      const theme = this._current();
      this.document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {}
    });
  }

  set(theme: ThemeName): void {
    this._current.set(theme);
  }

  toggle(): void {
    this._current.update(t => (t === 'light' ? 'dark' : 'light'));
  }

  private loadInitial(): ThemeName {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
      if (stored && this.themes.includes(stored)) return stored;
    } catch {}
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return DEFAULT_THEME;
  }
}
