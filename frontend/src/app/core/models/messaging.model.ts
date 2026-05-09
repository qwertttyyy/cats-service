import { User } from './user.model';

export interface WsTicket {
  ticket: string;
  expires_in: number;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender: User;
  recipient: User;
  text: string;
  sent_at: string;
}

export interface ChatSummary {
  chat_id: string;
  participant: User;
  last_message: ChatMessage | null;
  updated_at: string;
  unread_count?: number;
}

export interface WsOutgoingPrivateMessage {
  type: 'private_message';
  recipient_id: string;
  text: string;
}

export interface WsIncomingPrivateMessage {
  type: 'private_message';
  message: ChatMessage;
}

export interface WsIncomingError {
  type: 'error';
  error: string;
}

export interface WsMessageAck {
  type: 'message_ack';
  message_id: string;
  chat_id: string;
  recipient_id: string;
  sent_at: string;
}

export type WsIncomingEvent = WsIncomingPrivateMessage | WsIncomingError | WsMessageAck;
