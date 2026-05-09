import { Injectable, inject } from '@angular/core';
import { Subject, Subscription, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MessagingApiService } from '../api/messaging-api.service';
import { WsIncomingEvent, WsOutgoingPrivateMessage } from '../models/messaging.model';

type SocketState = 'disconnected' | 'connecting' | 'connected';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private readonly messagingApi = inject(MessagingApiService);
  private socket: WebSocket | null = null;
  private retryCount = 0;
  private connectSubscription: Subscription | null = null;
  private manualClose = false;

  readonly events$ = new Subject<WsIncomingEvent>();
  readonly errors$ = new Subject<string>();
  readonly state$ = new Subject<SocketState>();

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.manualClose = false;
    this.openWithTicket();
  }

  disconnect(): void {
    this.manualClose = true;
    this.retryCount = 0;
    this.connectSubscription?.unsubscribe();
    this.connectSubscription = null;
    this.socket?.close();
    this.socket = null;
    this.state$.next('disconnected');
  }

  sendPrivateMessage(recipientId: string, text: string): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.errors$.next('Соединение с чатом ещё не установлено.');
      return false;
    }

    const payload: WsOutgoingPrivateMessage = {
      type: 'private_message',
      recipient_id: recipientId,
      text,
    };
    this.socket.send(JSON.stringify(payload));
    return true;
  }

  private openWithTicket(): void {
    this.state$.next('connecting');
    this.connectSubscription?.unsubscribe();
    this.connectSubscription = this.messagingApi.createWsTicket().subscribe({
      next: ({ ticket }) => this.openSocket(ticket),
      error: () => {
        this.errors$.next('Не удалось получить доступ к чату.');
        this.scheduleReconnect();
      },
    });
  }

  private openSocket(ticket: string): void {
    const socket = new WebSocket(`${this.buildWsBaseUrl()}/messages/?ticket=${encodeURIComponent(ticket)}`);
    this.socket = socket;

    socket.onopen = () => {
      this.retryCount = 0;
      this.state$.next('connected');
    };

    socket.onmessage = (event) => {
      try {
        this.events$.next(JSON.parse(String(event.data)) as WsIncomingEvent);
      } catch {
        this.errors$.next('Получено некорректное сообщение чата.');
      }
    };

    socket.onerror = () => {
      this.errors$.next('Ошибка WebSocket-соединения.');
    };

    socket.onclose = () => {
      this.socket = null;
      this.state$.next('disconnected');
      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.retryCount >= 3 || this.manualClose) {
      return;
    }

    this.retryCount += 1;
    timer(800 * this.retryCount).subscribe(() => {
      if (!this.manualClose) {
        this.openWithTicket();
      }
    });
  }

  private buildWsBaseUrl(): string {
    if (environment.wsUrl) {
      return environment.wsUrl.replace(/\/$/, '');
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
}
