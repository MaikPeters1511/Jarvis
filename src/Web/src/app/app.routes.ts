import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/chat/chat.component').then(m => m.ChatComponent),
    title: 'Javis - Chat',
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
    title: 'Javis - Einstellungen',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
