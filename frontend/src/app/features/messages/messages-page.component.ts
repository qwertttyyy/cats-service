import { Component, computed, DestroyRef, ElementRef, inject, OnDestroy, signal, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { extractApiError } from '../../core/api/api-error';
import { BreedersApiService } from '../../core/api/breeders-api.service';
import { MessagingApiService } from '../../core/api/messaging-api.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  ChatMessage,
  MessageUser,
  WsIncomingEvent,
} from '../../core/models/messaging.model';
import { Breeder, User } from '../../core/models/user.model';
import { WebSocketService } from '../../core/websocket/websocket.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

const BREEDERS_LIMIT = 20;
const MESSAGES_LIMIT = 50;

@Component({
  selector: 'app-messages-page',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatBadgeModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    EmptyStateComponent,
  ],
  template: `
    <section class="messages-page">
      <aside class="breeders-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Диалоги</p>
            <h1>Заводчики</h1>
          </div>
          <span class="socket-state" [class.online]="socketConnected()">
            {{ socketConnected() ? 'online' : 'offline' }}
          </span>
        </div>

        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Поиск заводчика</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [formControl]="searchControl" />
        </mat-form-field>

        <div class="breeders-list" (scroll)="onBreedersScroll($event)">
          @if (breedersLoading() && breeders().length === 0) {
            <div class="center-state"><mat-spinner diameter="36" /></div>
          } @else if (breeders().length === 0) {
            <app-empty-state icon="person_search" title="Заводчики не найдены" />
          } @else {
            <div class="breeders-list-items" role="list">
              @for (breeder of breeders(); track breeder.public_id) {
                <button
                  type="button"
                  class="breeder-item"
                  role="listitem"
                  [class.selected]="selectedBreeder()?.public_id === breeder.public_id"
                  (click)="selectBreeder(breeder)"
                >
                  <mat-icon [matBadge]="unreadCount(breeder)" [matBadgeHidden]="unreadCount(breeder) === 0" matBadgeColor="accent">
                    account_circle
                  </mat-icon>
                  <span class="breeder-text">
                    <span class="breeder-title">{{ breeder.username }}</span>
                    <span class="breeder-subtitle">{{ displayName(breeder) || 'Имя не указано' }}</span>
                  </span>
                </button>
              }
            </div>
            @if (breedersLoading()) {
              <mat-progress-bar mode="indeterminate" />
            }
          }
        </div>
      </aside>

      <section class="chat-panel">
        @if (selectedBreeder(); as breeder) {
          <header class="chat-head">
            <div class="avatar"><mat-icon>account_circle</mat-icon></div>
            <div>
              <h2>{{ breeder.username }}</h2>
              <p>{{ displayName(breeder) || 'Заводчик Cats Service' }}</p>
            </div>
          </header>

          <div
            class="messages-list"
            #messagesList
            (scroll)="onMessagesScroll($event)"
          >
            @if (messagesLoading() && selectedMessages().length === 0) {
              <div class="center-state"><mat-spinner diameter="36" /></div>
            } @else if (selectedMessages().length === 0) {
              <app-empty-state
                icon="chat_bubble_outline"
                title="Сообщений пока нет"
                description="Напишите первым."
              />
            } @else {
              @if (olderMessagesLoading()) {
                <div class="history-loader"><mat-spinner diameter="24" /></div>
              }
              @for (message of selectedMessages(); track message.id) {
                <div class="message-row" [class.mine]="isMine(message)">
                  <div class="message-bubble">
                    <div class="message-meta">
                      <span>{{ message.sender.username }}</span>
                      <time>{{ message.sent_at | date:'HH:mm' }}</time>
                    </div>
                    <p>{{ message.text }}</p>
                  </div>
                </div>
              }
            }
          </div>

          <form class="composer" (submit)="sendMessage($event)">
            <mat-form-field appearance="outline">
              <mat-label>Сообщение</mat-label>
              <textarea
                matInput
                rows="2"
                [formControl]="messageControl"
                maxlength="2000"
                (keydown)="handleMessageKeydown($event)"
              ></textarea>
              @if (messageControl.hasError('required')) {
                <mat-error>Введите текст сообщения</mat-error>
              }
            </mat-form-field>
            <button mat-flat-button color="primary" type="submit" [disabled]="messageControl.invalid || !socketConnected()">
              <mat-icon>send</mat-icon>
              Отправить
            </button>
          </form>
        } @else {
          <app-empty-state
            icon="forum"
            title="Выберите заводчика, чтобы начать диалог"
            description="Сообщения доставляются через WebSocket, история хранится в backend."
          />
        }
      </section>
    </section>
  `,
  styleUrl: './messages-page.component.scss',
})
export class MessagesPageComponent implements OnDestroy {
  private readonly breedersApi = inject(BreedersApiService);
  private readonly messagingApi = inject(MessagingApiService);
  private readonly auth = inject(AuthService);
  private readonly ws = inject(WebSocketService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('messagesList') private messagesList?: ElementRef<HTMLDivElement>;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly messageControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });

  readonly breeders = signal<Breeder[]>([]);
  readonly selectedBreeder = signal<Breeder | null>(null);
  readonly breedersLoading = signal(false);
  readonly messagesLoading = signal(false);
  readonly olderMessagesLoading = signal(false);
  readonly socketConnected = signal(false);

  private breedersOffset = 0;
  private breedersCount = 0;
  private breedersRequestId = 0;
  private messagesRequestId = 0;
  private olderMessagesRequestId = 0;
  private readonly messagesByParticipant = signal(new Map<string, ChatMessage[]>());
  private readonly messagesCountByParticipant = signal(new Map<string, number>());
  private readonly unreadByParticipant = signal(new Map<string, number>());

  readonly selectedMessages = computed(() => {
    const breeder = this.selectedBreeder();
    if (!breeder) {
      return [];
    }
    return this.messagesByParticipant().get(breeder.public_id) ?? [];
  });

  constructor() {
    this.bindSearch();
    this.bindSocket();
    this.loadBreeders(true);
    this.ws.connect();
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
  }

  displayName(user: User): string {
    return [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  }

  unreadCount(user: User): number {
    return this.unreadByParticipant().get(user.public_id) ?? 0;
  }

  selectBreeder(breeder: Breeder): void {
    this.selectedBreeder.set(breeder);
    this.updateUnread((unread) => {
      unread.delete(breeder.public_id);
    });
    this.loadHistory(breeder);
  }

  onBreedersScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const nearBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 120;
    const hasMore = this.breeders().length < this.breedersCount;
    if (nearBottom && hasMore && !this.breedersLoading()) {
      this.loadBreeders(false);
    }
  }

  onMessagesScroll(event: Event): void {
    const element = event.target as HTMLElement;
    if (element.scrollTop <= 120) {
      this.loadOlderMessages();
    }
  }

  sendMessage(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    const breeder = this.selectedBreeder();
    if (!breeder || this.messageControl.invalid) {
      this.messageControl.markAsTouched();
      return;
    }

    const text = this.messageControl.value.trim();
    if (!text) {
      this.messageControl.setErrors({ required: true });
      return;
    }

    if (this.ws.sendPrivateMessage(breeder.public_id, text)) {
      this.messageControl.reset('');
    }
  }

  handleMessageKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing) {
      return;
    }

    if (event.ctrlKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.sendMessage();
  }

  isMine(message: ChatMessage): boolean {
    return message.sender.public_id === this.auth.currentUser?.public_id;
  }

  private bindSearch(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.loadBreeders(true);
      });
  }

  private bindSocket(): void {
    this.ws.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.socketConnected.set(state === 'connected');
      });

    this.ws.errors$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message) => {
        this.snackBar.open(message, 'Закрыть', { duration: 4000 });
      });

    this.ws.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.handleSocketEvent(event));
  }

  private loadBreeders(reset: boolean): void {
    const requestId = reset ? ++this.breedersRequestId : this.breedersRequestId;

    if (reset) {
      this.breeders.set([]);
      this.breedersOffset = 0;
      this.breedersCount = 0;
    }

    this.breedersLoading.set(true);
    this.breedersApi.getBreeders(this.searchControl.value, BREEDERS_LIMIT, this.breedersOffset)
      .pipe(
        finalize(() => {
          if (requestId === this.breedersRequestId) {
            this.breedersLoading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.breedersRequestId) {
            return;
          }

          const currentUserId = this.auth.currentUser?.public_id;
          const currentBreeders = this.breeders();
          this.breedersCount = response.count;
          const known = new Set(currentBreeders.map((item) => item.public_id));
          const nextBreeders = response.results.filter(
            (item) => item.public_id !== currentUserId && !known.has(item.public_id),
          );
          const updatedBreeders = [...currentBreeders, ...nextBreeders];
          this.breeders.set(updatedBreeders);
          this.breedersOffset = updatedBreeders.length;
        },
        error: (error: unknown) => {
          this.snackBar.open(extractApiError(error), 'Закрыть', {
            duration: 4500,
          });
        },
      });
  }

  private loadHistory(breeder: Breeder): void {
    const requestId = ++this.messagesRequestId;
    this.olderMessagesLoading.set(false);
    this.messagesLoading.set(true);

    this.messagingApi.getMessages(breeder.public_id, MESSAGES_LIMIT, 0)
      .pipe(
        finalize(() => {
          if (requestId === this.messagesRequestId) {
            this.messagesLoading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.messagesRequestId) {
            return;
          }

          this.setParticipantMessages(breeder.public_id, response.results);
          this.setMessagesCount(breeder.public_id, response.count);
          this.scrollMessagesToBottom();
        },
        error: (error: unknown) => {
          this.snackBar.open(extractApiError(error), 'Закрыть', { duration: 4500 });
        },
      });
  }

  private loadOlderMessages(): void {
    const breeder = this.selectedBreeder();
    if (!breeder || this.messagesLoading() || this.olderMessagesLoading()) {
      return;
    }

    const participantId = breeder.public_id;
    const existing = this.messagesByParticipant().get(participantId) ?? [];
    const total = this.messagesCountByParticipant().get(participantId) ?? 0;
    if (existing.length === 0 || existing.length >= total) {
      return;
    }

    const element = this.messagesList?.nativeElement;
    const previousScrollHeight = element?.scrollHeight ?? 0;
    const previousScrollTop = element?.scrollTop ?? 0;
    const requestId = ++this.olderMessagesRequestId;
    this.olderMessagesLoading.set(true);

    this.messagingApi
      .getMessages(participantId, MESSAGES_LIMIT, existing.length)
      .pipe(
        finalize(() => {
          if (requestId === this.olderMessagesRequestId) {
            this.olderMessagesLoading.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          const current = this.messagesByParticipant().get(participantId) ?? [];
          const knownIds = new Set(current.map((message) => message.id));
          const olderMessages = response.results.filter(
            (message) => !knownIds.has(message.id),
          );
          if (olderMessages.length === 0) {
            this.setMessagesCount(
              participantId,
              Math.max(response.count, current.length),
            );
            return;
          }

          const mergedMessages = [...olderMessages, ...current];
          this.setParticipantMessages(participantId, mergedMessages);
          this.setMessagesCount(
            participantId,
            Math.max(response.count, mergedMessages.length),
          );
          this.restoreMessagesScroll(
            previousScrollHeight,
            previousScrollTop,
            participantId,
          );
        },
        error: (error: unknown) => {
          this.snackBar.open(extractApiError(error), 'Закрыть', {
            duration: 4500,
          });
        },
      });
  }

  private handleSocketEvent(event: WsIncomingEvent): void {
    if (event.type === 'error') {
      this.snackBar.open(event.error, 'Закрыть', { duration: 4500 });
      return;
    }

    if (event.type !== 'private_message') {
      return;
    }

    const currentUserId = this.auth.currentUser?.public_id;
    const participant = event.message.sender.public_id === currentUserId
      ? event.message.recipient
      : event.message.sender;

    this.addBreederIfMissing(participant);
    const existing = this.messagesByParticipant().get(participant.public_id) ?? [];
    if (!existing.some((message) => message.id === event.message.id)) {
      this.incrementMessagesCount(participant.public_id);
      this.setParticipantMessages(participant.public_id, [...existing, event.message]);
    }

    if (this.selectedBreeder()?.public_id === participant.public_id) {
      this.scrollMessagesToBottom();
    } else {
      this.updateUnread((unread) => {
        unread.set(participant.public_id, (unread.get(participant.public_id) ?? 0) + 1);
      });
    }
  }

  private addBreederIfMissing(user: MessageUser): void {
    if (this.auth.currentUser?.public_id === user.public_id) {
      return;
    }

    if (!this.breeders().some((breeder) => breeder.public_id === user.public_id)) {
      this.breeders.update((breeders) => [
        { ...user, date_joined: '' },
        ...breeders,
      ]);
      this.breedersCount += 1;
    }
  }

  private setParticipantMessages(participantId: string, messages: ChatMessage[]): void {
    this.messagesByParticipant.update((current) => {
      const next = new Map(current);
      next.set(participantId, messages);
      return next;
    });
  }

  private setMessagesCount(participantId: string, count: number): void {
    this.messagesCountByParticipant.update((current) => {
      const next = new Map(current);
      next.set(participantId, count);
      return next;
    });
  }

  private incrementMessagesCount(participantId: string): void {
    const loadedCount = this.messagesByParticipant().get(participantId)?.length ?? 0;
    this.messagesCountByParticipant.update((current) => {
      const next = new Map(current);
      next.set(participantId, (next.get(participantId) ?? loadedCount) + 1);
      return next;
    });
  }

  private updateUnread(update: (unread: Map<string, number>) => void): void {
    this.unreadByParticipant.update((current) => {
      const next = new Map(current);
      update(next);
      return next;
    });
  }

  private scrollMessagesToBottom(): void {
    setTimeout(() => {
      const element = this.messagesList?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  private restoreMessagesScroll(
    previousScrollHeight: number,
    previousScrollTop: number,
    participantId: string,
  ): void {
    setTimeout(() => {
      if (this.selectedBreeder()?.public_id !== participantId) {
        return;
      }

      const element = this.messagesList?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight - previousScrollHeight + previousScrollTop;
      }
    });
  }
}
