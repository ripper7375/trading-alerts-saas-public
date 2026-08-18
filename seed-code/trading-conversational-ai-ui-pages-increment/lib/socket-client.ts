'use client';

import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'agent';
  text: string;
  /**
   * Raw ISO-8601 timestamp (from `new Date().toISOString()`). Stored raw
   * because this class is a plain TS module (no React/useLocale access) —
   * consumers must format it for display via useLocale()'s
   * formatTimestamp() at render time, not here.
   */
  timestamp: string;
  topic?: string;
}

const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_CHAT_URL || 'http://localhost:3001';

class ChatSocketManager {
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  public initSocket(onMessageReceived?: (msg: ChatMessage) => void) {
    if (this.socket) return this.socket;

    try {
      this.socket = io(SOCKET_SERVER_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: false,
        reconnectionAttempts: 3,
        timeout: 5000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log('[Socket.io] Connected to Davin Support Server');
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        console.log('[Socket.io] Disconnected from Davin Support Server');
      });

      this.socket.on('support_message', (data: ChatMessage) => {
        if (onMessageReceived) {
          onMessageReceived(data);
        }
      });
    } catch (err) {
      console.warn('[Socket.io] Initialization fallback mode active:', err);
    }

    return this.socket;
  }

  public sendMessage(
    text: string,
    topic?: string,
    onFallbackReply?: (reply: ChatMessage) => void
  ): ChatMessage {
    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
      topic,
    };

    if (this.socket && this.isConnected) {
      this.socket.emit('client_message', userMessage);
    } else {
      // Intelligent fallback support bot response generator
      setTimeout(() => {
        const reply = this.generateFallbackResponse(text, topic);
        if (onFallbackReply) {
          onFallbackReply(reply);
        }
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
