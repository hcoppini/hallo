'use client';

import { DrinkType, ServeDrinkResult } from './types';
import { supabase, isSupabaseConfigured } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const RELAY_CHANNEL_NAME = 'halloween_nfc_relay_v1';
const RELAY_STORAGE_KEY = 'halloween_nfc_relay_event_v1';
const SUPABASE_RELAY_CHANNEL = 'party_nfc_relay';

export type RelayMessageType =
  | 'PING_STATION'
  | 'STATION_ACK'
  | 'TAG_TAPPED'
  | 'DRINK_SERVED'
  | 'NEW_TAP_TAB_OPENED'
  | 'GUEST_CHECKED_IN'
  | 'GUEST_ROSTER_UPDATED';

export interface TagRelayMessage {
  type: RelayMessageType;
  tabId: string;
  timestamp: number;
  tagId?: string;
  rawId?: string;
  hardwareUid?: string;
  station?: 'barman' | 'door';
  drinkType?: DrinkType;
  result?: ServeDrinkResult;
  guestName?: string | null;
  isAssigned?: boolean;
  guest?: any;
  importedGuests?: any[];
}

type RelayListener = (msg: TagRelayMessage) => void;

const currentTabId =
  typeof window !== 'undefined'
    ? `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    : 'server';

let broadcastChannel: BroadcastChannel | null = null;
let supabaseRelayChannel: RealtimeChannel | null = null;
let isInitialized = false;
const listeners = new Set<RelayListener>();

function initRelay() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  // 1. Same-browser BroadcastChannel (0ms latency between Chrome/Safari tabs on iPhone)
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(RELAY_CHANNEL_NAME);
      broadcastChannel.onmessage = (event: MessageEvent<TagRelayMessage>) => {
        const msg = event.data;
        if (msg && msg.tabId !== currentTabId) {
          notifyListeners(msg);
        }
      };
    } catch {
      // Fallback to storage event
    }
  }

  // 2. LocalStorage fallback for older WebKit / cross-tab within same browser
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === RELAY_STORAGE_KEY && event.newValue) {
      try {
        const msg = JSON.parse(event.newValue) as TagRelayMessage;
        if (msg && msg.tabId !== currentTabId) {
          notifyListeners(msg);
        }
      } catch {}
    }
  });

  // 3. Supabase Realtime Broadcast (cross-browser & cross-device relay, e.g. Chrome -> Safari PWA / iPad)
  if (isSupabaseConfigured && supabase) {
    try {
      supabaseRelayChannel = supabase.channel(SUPABASE_RELAY_CHANNEL, {
        config: { broadcast: { self: false } },
      });

      supabaseRelayChannel
        .on('broadcast', { event: 'nfc_tap_relay' }, payload => {
          const msg = payload?.payload as TagRelayMessage | undefined;
          if (msg && msg.tabId !== currentTabId) {
            notifyListeners(msg);
          }
        })
        .subscribe();
    } catch {}
  }

  // 4. Local ACR122U Hardware Bridge (WebSocket on 127.0.0.1:4567)
  connectLocalNfcBridge();

  // 5. Native Desktop Window Tap Hook
  (window as any).__onNfcTap = (tagId: string, hardwareUid?: string) => {
    if (!tagId) return;
    notifyListeners({
      type: 'TAG_TAPPED',
      tagId,
      rawId: hardwareUid || tagId,
      timestamp: Date.now(),
      tabId: 'desktop_window_direct',
    });
  };
}

let localWs: WebSocket | null = null;
let wsReconnectTimeout: any = null;

function connectLocalNfcBridge() {
  if (typeof window === 'undefined') return;
  try {
    localWs = new WebSocket('ws://127.0.0.1:4567');
    localWs.onopen = () => {
      // connected to local ACR122U hardware bridge
    };
    localWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && (data.type === 'TAG_TAPPED' || !data.type) && (data.tagId || data.tag || data.uid)) {
          const incomingTag = data.tagId || data.tag || data.uid;
          notifyListeners({
            type: 'TAG_TAPPED',
            tagId: incomingTag,
            rawId: data.hardwareUid || data.uid || incomingTag,
            hardwareUid: data.hardwareUid || data.uid || incomingTag,
            timestamp: Date.now(),
            tabId: 'acr122u_local_bridge',
          });
        }
      } catch {}
    };
    localWs.onclose = () => {
      localWs = null;
      if (!wsReconnectTimeout) {
        wsReconnectTimeout = setTimeout(() => {
          wsReconnectTimeout = null;
          connectLocalNfcBridge();
        }, 3000);
      }
    };
    localWs.onerror = () => {
      localWs?.close();
    };
  } catch {}
}

let lastReceivedTapKey = '';
let lastReceivedTapTime = 0;

function notifyListeners(msg: TagRelayMessage) {
  if (msg.type === 'TAG_TAPPED') {
    const tapKey = (msg.tagId || msg.rawId || '').trim();
    const now = Date.now();
    if (tapKey && tapKey === lastReceivedTapKey && now - lastReceivedTapTime < 1200) {
      // Debounce duplicate tap delivered via dual broadcast (Local WebSocket + Supabase Cloud)
      return;
    }
    lastReceivedTapKey = tapKey;
    lastReceivedTapTime = now;
  }

  listeners.forEach(fn => {
    try {
      fn(msg);
    } catch {}
  });
}

export function getTabId(): string {
  return currentTabId;
}

/**
 * Broadcasts a tag relay event to all open tabs on this phone (and optionally across devices via Supabase)
 */
export function sendTagRelayMessage(
  msg: Omit<TagRelayMessage, 'tabId' | 'timestamp'>,
  options: { broadcastCrossDevice?: boolean } = {}
): void {
  if (typeof window === 'undefined') return;
  initRelay();

  const fullMsg: TagRelayMessage = {
    ...msg,
    tabId: currentTabId,
    timestamp: Date.now(),
  };

  // 1. BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(fullMsg);
    } catch {}
  }

  // 2. LocalStorage event
  try {
    localStorage.setItem(RELAY_STORAGE_KEY, JSON.stringify(fullMsg));
  } catch {}

  // 3. Cross-device / cross-browser Supabase Broadcast (only for authenticated staff events)
  if (options.broadcastCrossDevice && supabaseRelayChannel) {
    try {
      supabaseRelayChannel.send({
        type: 'broadcast',
        event: 'nfc_tap_relay',
        payload: fullMsg,
      });
    } catch {}
  }
}

/**
 * Subscribe to incoming tag relay messages from other tabs or devices
 */
export function subscribeToTagRelay(listener: RelayListener): () => void {
  if (typeof window !== 'undefined') {
    initRelay();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Attempts to close the current browser tab after relaying the NFC tap to an already-open dashboard tab
 */
export function attemptAutoCloseTab(): void {
  if (typeof window === 'undefined') return;
  try {
    window.close();
  } catch {}
  try {
    window.open('', '_self')?.close();
  } catch {}
}
