import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService, ThemeName } from '../../core/theme/theme.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="navbar bg-base-100/60 backdrop-blur-md border-b border-base-content/5 sticky top-0 z-50 px-4 md:px-8 shadow-sm">
      <div class="flex-1">
        <a routerLink="/" class="flex items-center gap-2.5 font-black text-xl tracking-tight transition-all duration-300 hover:opacity-85">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-lg shadow-md shadow-primary/20">
            🎙️
          </div>
          <span class="bg-gradient-to-r from-base-content to-base-content/80 bg-clip-text text-transparent">Javis</span>
        </a>
        
        <nav class="hidden md:flex gap-2 ml-8">
          <a routerLink="/" 
             routerLinkActive="bg-primary text-primary-content shadow-md shadow-primary/10" 
             [routerLinkActiveOptions]="{exact: true}" 
             class="px-4 py-1.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all duration-300 hover:bg-base-200">
            Chat
          </a>
          <a routerLink="/settings" 
             routerLinkActive="bg-primary text-primary-content shadow-md shadow-primary/10" 
             class="px-4 py-1.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all duration-300 hover:bg-base-200">
            Einstellungen
          </a>
        </nav>
      </div>
      
      <div class="flex-none gap-3">
        <!-- Tiny status dot for design charm -->
        <div class="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20">
          <span class="w-1.5 h-1.5 rounded-full bg-success animate-ping"></span>
          <span>Online</span>
        </div>

        <div class="relative">
          <select
            class="select select-bordered select-xs rounded-xl glass-card border-base-content/10 font-medium pl-2 pr-8 py-1 h-8 text-xs cursor-pointer focus:outline-none focus:border-primary"
            [value]="theme.current()"
            (change)="onThemeChange($any($event.target).value)"
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
