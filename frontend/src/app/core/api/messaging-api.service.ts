import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatMessage, WsTicket } from '../models/messaging.model';
import { PaginatedResponse } from '../models/pagination.model';

@Injectable({ providedIn: 'root' })
export class MessagingApiService {
  private readonly http = inject(HttpClient);

  createWsTicket(): Observable<WsTicket> {
    return this.http.post<WsTicket>(`${environment.apiUrl}/ws-tickets/`, {});
  }

  getMessages(
    participantId: string,
    limit = 50,
    offset = 0,
  ): Observable<PaginatedResponse<ChatMessage>> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<PaginatedResponse<ChatMessage>>(
      `${environment.apiUrl}/chats/${participantId}/messages/`,
      { params },
    );
  }
}
