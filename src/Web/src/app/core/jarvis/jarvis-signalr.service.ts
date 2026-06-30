import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { getApiBaseUrl } from '../api/api-base-url.interceptor';

export interface JarvisStatusUpdate {
  status: string;
  message: string;
  timestamp: string;
}

/**
 * SignalR client for the JarvisHub. Receives status updates from the backend.
 */
@Injectable({ providedIn: 'root' })
export class JarvisSignalRService implements OnDestroy {
  private readonly _connected = signal(false);
  readonly connected = this._connected.asReadonly();
  readonly status$ = new Subject<JarvisStatusUpdate>();

  private connection: signalR.HubConnection | null = null;

  connect(): void {
    if (this.connection) return;
    const apiBase = getApiBaseUrl();
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${apiBase}/hubs/jarvis`)
      .withAutomaticReconnect()
      .build();

    this.connection.on('StatusChanged', (payload: JarvisStatusUpdate) => {
      this.status$.next(payload);
    });

    this.connection.onclose(() => this._connected.set(false));
    this.connection.onreconnecting(() => this._connected.set(false));
    this.connection.onreconnected(() => this._connected.set(true));

    this.connection.start()
      .then(() => this._connected.set(true))
      .catch(err => console.error('SignalR connect failed', err));
  }

  disconnect(): void {
    this.connection?.stop();
    this.connection = null;
    this._connected.set(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
