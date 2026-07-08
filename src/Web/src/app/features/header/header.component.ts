import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ThemeService, ThemeName } from '../../core/theme/theme.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, FormsModule],
  template: `
    <header class="navbar bg-base-100/55 backdrop-blur-xl border-b border-base-content/5 sticky top-0 z-50 px-4 md:px-8 relative">
      <!-- Bottom accent line -->
      <div class="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>

      <div class="flex-1">
        <a routerLink="/" class="flex items-center gap-3 transition-all duration-300 hover:opacity-90 group">
          <div class="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25 transition-transform duration-300 group-hover:scale-105">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-primary-content" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
            <span class="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20"></span>
          </div>
          <span class="font-display font-bold text-xl tracking-tight gradient-text">Javis</span>
        </a>

        <nav class="hidden md:flex gap-1 ml-10">
          <a routerLink="/"
             routerLinkActive="bg-primary/15 text-primary"
             [routerLinkActiveOptions]="{exact: true}"
             class="px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all duration-300 hover:bg-base-200 text-base-content/70">
            Chat
          </a>
          <a routerLink="/settings"
             routerLinkActive="bg-primary/15 text-primary"
             class="px-4 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all duration-300 hover:bg-base-200 text-base-content/70">
            Einstellungen
          </a>
        </nav>
      </div>

      <div class="flex-none gap-2 md:gap-3">
        <!-- Status indicator -->
        <div class="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-success/10 text-success border border-success/20">
          <span class="relative flex w-1.5 h-1.5">
            <span class="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping"></span>
            <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
          </span>
          <span class="hidden sm:inline">Online</span>
        </div>

        <div class="relative flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 absolute left-2.5 pointer-events-none text-base-content/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C22 6.012 17.461 2 12 2Z"/>
          </svg>
          <select
            class="select select-bordered select-xs rounded-xl glass-card border-base-content/10 font-medium pl-8 pr-7 py-1 h-8 text-xs cursor-pointer focus:outline-none focus:border-primary appearance-none"
            [ngModel]="theme.current()"
            (ngModelChange)="onThemeChange($event)"
            aria-label="Theme-Auswahl"
            data-testid="theme-select">
            @for (t of theme.themes; track t) {
              <option [value]="t">{{ t }}</option>
            }
          </select>
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  readonly theme = inject(ThemeService);

  onThemeChange(value: string): void {
    this.theme.set(value as ThemeName);
  }
}
