'use client';

import { useState, useEffect, useCallback } from 'react';
import { Guest, PartySettings, DrinkLog, ServeDrinkResult, DoorCheckInInput, DrinkType } from './types';
import {
  processDrinkRequest,
  revertDrinkRequest,
  checkInGuest as engineCheckIn,
  generateWristbandBatch,
} from './party-engine';
import { supabase, isSupabaseConfigured } from './supabase';
import { soundSystem } from './audio';

const STORAGE_KEY_SETTINGS = 'halloween_party_settings_v1';
const STORAGE_KEY_GUESTS = 'halloween_party_guests_v1';
const STORAGE_KEY_LOGS = 'halloween_party_logs_v1';

const initialSettings: PartySettings = {
  id: 'default_party',
  party_name: 'Halloween Birthday Party 2026',
  default_drink_limit: 5,
  is_party_active: true,
  admin_pin: '1031',
  cutoff_time: null,
};

/**
 * Reads initial state safely from localStorage or defaults
 */
function getInitialLocalData() {
  if (typeof window === 'undefined') {
    return {
      settings: initialSettings,
      guests: generateWristbandBatch(100),
      logs: [] as DrinkLog[],
    };
  }

  let settings = initialSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) settings = { ...initialSettings, ...JSON.parse(raw) };
  } catch {
    // fallback
  }

  let guests: Guest[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GUESTS);
    if (raw) guests = JSON.parse(raw);
  } catch {
    // fallback
  }

  if (!guests || guests.length === 0) {
    guests = generateWristbandBatch(100);
    // Seed a couple mock checked-in guests for instant rich UI demo
    guests[0] = {
      ...guests[0],
      name: 'Janek Smagieł',
      category: 'standard',
      is_entered: true,
      entered_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      drinks_consumed: 3,
    };
    guests[1] = {
      ...guests[1],
      name: 'Kasia (Host)',
      category: 'vip',
      is_entered: true,
      entered_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      drinks_consumed: 2,
    };
    guests[2] = {
      ...guests[2],
      name: 'Mikołaj (Driver)',
      category: 'driver_minor',
      is_entered: true,
      entered_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      drinks_consumed: 0,
    };
    try {
      localStorage.setItem(STORAGE_KEY_GUESTS, JSON.stringify(guests));
    } catch {}
  }

  let logs: DrinkLog[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    if (raw) logs = JSON.parse(raw);
  } catch {
    // fallback
  }

  return { settings, guests, logs };
}

// Global subscribers for multi-component reactive synchronization
type Listener = () => void;
const listeners = new Set<Listener>();

let globalSettings = initialSettings;
let globalGuests: Guest[] = [];
let globalLogs: DrinkLog[] = [];
let isInitialized = false;

function notifySubscribers() {
  listeners.forEach(fn => fn());
}

function persistLocalState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(globalSettings));
    localStorage.setItem(STORAGE_KEY_GUESTS, JSON.stringify(globalGuests));
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(globalLogs));
  } catch {
    // Storage quota or private mode protection
  }
}

/**
 * Core Party Store Hook
 */
export function usePartyStore() {
  const [, setTick] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      const data = getInitialLocalData();
      globalSettings = data.settings;
      globalGuests = data.guests;
      globalLogs = data.logs;
      isInitialized = true;
    }

    const rerender = () => setTick(t => t + 1);
    listeners.add(rerender);

    // If Supabase is connected, sync remote state
    if (isSupabaseConfigured && supabase) {
      syncFromSupabase();

      // Realtime subscription
      const channel = supabase
        .channel('party_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, () => {
          syncFromSupabase();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drink_logs' }, () => {
          syncFromSupabase();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'party_settings' }, () => {
          syncFromSupabase();
        })
        .subscribe();

      return () => {
        listeners.delete(rerender);
        supabase?.removeChannel(channel);
      };
    }

    return () => {
      listeners.delete(rerender);
    };
  }, []);

  const syncFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      setIsSyncing(true);
      const [settingsRes, guestsRes, logsRes] = await Promise.all([
        supabase.from('party_settings').select('*').single(),
        supabase.from('guests').select('*').order('id', { ascending: true }),
        supabase.from('drink_logs').select('*').order('served_at', { ascending: false }).limit(100),
      ]);

      if (settingsRes.data) globalSettings = { ...initialSettings, ...settingsRes.data };
      if (guestsRes.data && guestsRes.data.length > 0) globalGuests = guestsRes.data;
      if (logsRes.data) globalLogs = logsRes.data;

      persistLocalState();
      notifySubscribers();
    } catch (err) {
      console.warn('Supabase sync fallback to local storage:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * Serve Drink action (called by Barman or URL tap)
   */
  const serveDrink = useCallback(
    async (tagId: string, drinkType: DrinkType = 'cocktail'): Promise<ServeDrinkResult> => {
      const cleanTag = tagId.trim().toUpperCase();
      const guest = globalGuests.find(
        g => g.tag_id.toUpperCase() === cleanTag || g.id.toUpperCase() === cleanTag
      );

      if (!guest) {
        soundSystem.playErrorSound();
        return {
          success: false,
          error: 'GUEST_NOT_FOUND',
          message: `Wristband '${cleanTag}' is not registered in the system.`,
        };
      }

      // If guest hasn't entered yet, auto-check them in with placeholder name
      let activeGuest = guest;
      if (!activeGuest.is_entered) {
        activeGuest = {
          ...activeGuest,
          is_entered: true,
          entered_at: new Date().toISOString(),
          name: activeGuest.name || `Guest (${cleanTag})`,
        };
      }

      const result = processDrinkRequest(activeGuest, globalSettings, drinkType);

      if (result.success && result.guest) {
        const newGuest = result.guest;
        globalGuests = globalGuests.map(g => (g.id === newGuest.id ? newGuest : g));

        const newLog: DrinkLog = {
          id: result.log_id || `log-${Date.now()}`,
          guest_id: newGuest.id,
          drink_type: drinkType,
          served_at: new Date().toISOString(),
          served_by: 'barman',
          is_reverted: false,
        };
        globalLogs = [newLog, ...globalLogs];

        persistLocalState();
        notifySubscribers();

        // Multi-sensory sound & haptic cue
        if (result.is_limit_reached) {
          soundSystem.playLimitSound();
        } else if (result.is_final_drink) {
          soundSystem.playWarningSound();
        } else {
          soundSystem.playApprovedSound();
        }

        // Push to Supabase if connected
        if (isSupabaseConfigured && supabase) {
          supabase.from('guests').upsert(newGuest).then(() => {});
          supabase.from('drink_logs').insert(newLog).then(() => {});
        }
      } else {
        // Failed / Limit reached
        soundSystem.playLimitSound();
      }

      return result;
    },
    []
  );

  /**
   * Revert the most recent drink for a guest (Undo action)
   */
  const revertLastDrink = useCallback(async (guestId: string): Promise<boolean> => {
    const guest = globalGuests.find(g => g.id === guestId);
    if (!guest) return false;

    const lastLog = globalLogs.find(l => l.guest_id === guestId && !l.is_reverted);
    if (!lastLog) return false;

    const { updatedGuest, revertedLog } = revertDrinkRequest(guest, lastLog);

    globalGuests = globalGuests.map(g => (g.id === guestId ? updatedGuest : g));
    globalLogs = globalLogs.map(l => (l.id === revertedLog.id ? revertedLog : l));

    persistLocalState();
    notifySubscribers();
    soundSystem.playUndoSound();

    if (isSupabaseConfigured && supabase) {
      supabase.from('guests').update({ drinks_consumed: updatedGuest.drinks_consumed }).eq('id', guestId).then(() => {});
      supabase.from('drink_logs').update({ is_reverted: true, reverted_at: new Date().toISOString() }).eq('id', lastLog.id).then(() => {});
    }

    return true;
  }, []);

  /**
   * Door Check-in
   */
  const checkIn = useCallback(async (input: DoorCheckInInput): Promise<Guest> => {
    const updatedGuest = engineCheckIn(globalGuests, input);

    const exists = globalGuests.some(g => g.id === updatedGuest.id);
    if (exists) {
      globalGuests = globalGuests.map(g => (g.id === updatedGuest.id ? updatedGuest : g));
    } else {
      globalGuests = [updatedGuest, ...globalGuests];
    }

    persistLocalState();
    notifySubscribers();
    soundSystem.playApprovedSound();

    if (isSupabaseConfigured && supabase) {
      supabase.from('guests').upsert(updatedGuest).then(() => {});
    }

    return updatedGuest;
  }, []);

  /**
   * Update Guest properties (Name, custom limit, notes, category, blocked)
   */
  const updateGuest = useCallback(async (updates: Partial<Guest> & { id: string }): Promise<Guest | null> => {
    const guest = globalGuests.find(g => g.id === updates.id);
    if (!guest) return null;

    const updated: Guest = {
      ...guest,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    globalGuests = globalGuests.map(g => (g.id === updates.id ? updated : g));
    persistLocalState();
    notifySubscribers();

    if (isSupabaseConfigured && supabase) {
      supabase.from('guests').update(updates).eq('id', updates.id).then(() => {});
    }

    return updated;
  }, []);

  /**
   * Update Global Party Settings
   */
  const updateSettings = useCallback(async (newSettings: Partial<PartySettings>): Promise<PartySettings> => {
    globalSettings = {
      ...globalSettings,
      ...newSettings,
      updated_at: new Date().toISOString(),
    };

    persistLocalState();
    notifySubscribers();

    if (isSupabaseConfigured && supabase) {
      supabase.from('party_settings').upsert(globalSettings).then(() => {});
    }

    return globalSettings;
  }, []);

  /**
   * Reset / Re-seed party data
   */
  const resetParty = useCallback(async (count: number = 100): Promise<void> => {
    globalGuests = generateWristbandBatch(count);
    globalLogs = [];
    globalSettings = { ...initialSettings };

    persistLocalState();
    notifySubscribers();

    if (isSupabaseConfigured && supabase) {
      await supabase.from('drink_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('guests').delete().neq('id', 'NONE');
      await supabase.from('guests').insert(globalGuests);
    }
  }, []);

  /**
   * Export all guest and drink data to CSV format
   */
  const exportCsv = useCallback((): string => {
    const headers = ['ID', 'Tag ID', 'Name', 'Category', 'Entered', 'Entered At', 'Drinks Consumed', 'Effective Limit', 'Blocked', 'Notes'];
    const rows = globalGuests.map(g => [
      g.id,
      g.tag_id,
      `"${(g.name || '').replace(/"/g, '""')}"`,
      g.category,
      g.is_entered ? 'YES' : 'NO',
      g.entered_at || '',
      g.drinks_consumed,
      g.category === 'vip' ? 'UNLIMITED' : g.custom_drink_limit ?? globalSettings.default_drink_limit,
      g.is_blocked ? 'YES' : 'NO',
      `"${(g.notes || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }, []);

  return {
    settings: globalSettings,
    guests: globalGuests,
    logs: globalLogs,
    isSyncing,
    isSupabaseConnected: isSupabaseConfigured,
    serveDrink,
    revertLastDrink,
    checkIn,
    updateGuest,
    updateSettings,
    resetParty,
    exportCsv,
    refresh: syncFromSupabase,
  };
}
