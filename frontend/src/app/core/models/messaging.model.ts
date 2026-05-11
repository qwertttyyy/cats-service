import { User } from './user.model';

export type MessageUser = Pick<
  User,
  'public_id' | 'username' | 'first_name' | 'last_name'
>;

export interface WsTicket {
  ticket: string;
  expires_in: number;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender: MessageUser;
  recipient: MessageUser;
  text: string;
  sent_at: string;
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

export type WsIncomingEvent =
  | WsIncomingPrivateMessage
  | WsIncomingError
  | WsMessageAck;
