'use client';

// Ported + adapted from
// seed-code/trading-conversational-ai-ui-pages-increment/lib/socket-client.ts
// (Session 14-2, Decision 2). Wire contract frozen at Session 14-0 and proven
// live against the deployed Contabo stack at Session 14-1 -- do not deviate
// from the handshake shape, event names, or client_message payload shape
// without re-opening that contract.

import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'agent' | 'system';
  /**
   * Raw ISO-8601 timestamp (from `new Date().toISOString()`). Stored raw
   * because this class is a plain TS module (no React/useLocale access) —
   * consumers must format it for display via useLocale()'s
   * formatTimestamp() at render time, not here.
   */
  timestamp: string;
  text: string;
  topic?: string;
  quickReplies?: string[];
}

export interface ChatError {
  code:
    | 'UNAUTHORIZED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'QUOTA_EXCEEDED'
    | 'SERVER_ERROR';
  message: string;
}

export interface ChatSocketCallbacks {
  onMessage?: (msg: ChatMessage) => void;
  onTyping?: (isTyping: boolean) => void;
  onError?: (error: ChatError) => void;
  onConnectionChange?: (connected: boolean) => void;
}

const SOCKET_SERVER_URL = process.env['NEXT_PUBLIC_SOCKET_CHAT_URL'] ?? '';

class ChatSocketManager {
  private socket: Socket | null = null;
  private isConnected = false;
  private initStarted = false;

  /**
   * Fetches the BFF handshake token (GET /api/chat/token) then connects.
   * A missing/empty NEXT_PUBLIC_SOCKET_CHAT_URL is a supported offline mode,
   * not an error -- sendMessage() below degrades to the canned fallback
   * generator and nothing here throws or logs noise for that case.
   */
  public async initSocket(
    callbacks: ChatSocketCallbacks = {}
  ): Promise<Socket | null> {
    if (this.initStarted) return this.socket;
    this.initStarted = true;

    if (!SOCKET_SERVER_URL) {
      return null;
    }

    let token: string | null = null;
    try {
      const res = await fetch('/api/chat/token');
      if (res.ok) {
        const data = (await res.json()) as { token: string | null };
        token = data.token;
      }
    } catch (err) {
      console.warn(
        '[Socket.io] Failed to fetch chat handshake token, connecting as guest:',
        err
      );
    }

    try {
      this.socket = io(SOCKET_SERVER_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        callbacks.onConnectionChange?.(true);
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        callbacks.onConnectionChange?.(false);
      });

      this.socket.on('support_message', (data: ChatMessage) => {
        callbacks.onMessage?.(data);
      });

      this.socket.on('bot_typing', (data: { isTyping: boolean }) => {
        callbacks.onTyping?.(data.isTyping);
      });

      this.socket.on('chat_error', (data: ChatError) => {
        callbacks.onError?.(data);
      });
    } catch (err) {
      console.warn('[Socket.io] Initialization fallback mode active:', err);
      this.socket = null;
    }

    return this.socket;
  }

  public sendMessage(
    text: string,
    topic?: string,
    onFallbackReply?: (reply: ChatMessage) => void
  ): ChatMessage {
    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
      topic,
    };

    if (this.socket && this.isConnected) {
      // client_message carries no client-asserted `sender` -- the server
      // stamps socket.data.user from the handshake token (Session 14-0 §4).
      this.socket.emit('client_message', {
        id: userMessage.id,
        text: userMessage.text,
        topic: userMessage.topic,
        timestamp: userMessage.timestamp,
      });
    } else {
      setTimeout(() => {
        onFallbackReply?.(this.generateFallbackResponse(text, topic));
      }, 1000);
    }

    return userMessage;
  }

  private generateFallbackResponse(
    userText: string,
    topic?: string
  ): ChatMessage {
    const lower = userText.toLowerCase();
    let replyText =
      "Hello! I am Davin AI Support Specialist. I'm here to assist you with DavinTrade SaaS features, terminal configurations, and account billing.";

    if (
      lower.includes('product info') ||
      lower.includes('feature') ||
      lower.includes('terminal')
    ) {
      replyText =
        'DavinTrade SaaS offers a 4-Panel AI Analyst Workbench with real-time TradingView lightweight charts, dual AI model confluence scoring, and sub-500ms server-side price breach alerts across Forex, Commodities, and Crypto.';
    } else if (
      lower.includes('technical support') ||
      lower.includes('alert') ||
      lower.includes('bug') ||
      lower.includes('help')
    ) {
      replyText =
        'Our technical support team monitors server-side price breach rules evaluated every 500ms. If you experience latency or chart sync issues, try refreshing your session or configuring custom line alerts in the Alert Rules Manager.';
    } else if (
      lower.includes('pro subscription') ||
      lower.includes('pro') ||
      lower.includes('upgrade') ||
      lower.includes('tier')
    ) {
      replyText =
        'The PRO Tier ($49/mo) unlocks the full 4-panel resizable workbench, unlimited 500ms line alerts, dual AI model confluence validation, and multi-currency local checkout (GBP £, INR ₹, VND ₫, THB ฿, etc.).';
    } else if (
      lower.includes('billing') ||
      lower.includes('invoice') ||
      lower.includes('payment') ||
      lower.includes('card')
    ) {
      replyText =
        'Billing is processed securely via Stripe & dLocal emerging market gateways. You can view, download, or update payment preferences in Settings -> Billing & Invoices.';
    } else if (lower.includes('how can i help you today')) {
      replyText =
        'Welcome to DavinTrade Support Centre! You can ask me about Product Info, Technical Support, PRO Subscriptions, or Billing details.';
    }

    return {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: replyText,
      timestamp: new Date().toISOString(),
      topic,
    };
  }
}

export const chatSocketManager = new ChatSocketManager();
