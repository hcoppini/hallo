'use client';

import { useState, useEffect, useCallback } from 'react';
import { Guest, PartySettings, DrinkLog, ServeDrinkResult, DoorCheckInInput, DrinkType } from './types';
import {
  processDrinkRequest,
  revertDrinkRequest,
  generateWristbandBatch,
} from './party-engine';
import { supabase, isSupabaseConfigured } from './supabase';
import { soundSystem } from './audio';
import {
  parseTagId,
  findGuestByTag,
  isTagMatch,
  isUniversalOnboardingTag,
  getNextFreeGuestSlot,
} from './tag-utils';

/**
 * Cleans up any legacy guest records that accidentally got bound to the literal `{UID}` / `UID` placeholder.
 */
function sanitizeLegacyUidGuests(guests: Guest[]): { sanitized: Guest[]; dirtyGuests: Guest[] } {
  const dirtyGuests: Guest[] = [];
  const sanitized = guests.map(g => {
    let changed = false;
    let notes = g.notes;
    let hardware_uid = g.hardware_uid;
    let tag_id = g.tag_id;

    if (notes && /\[UID:(?:UID|\{UID\}|UNIVERSAL|NEW|ONBOARD)\]/i.test(notes)) {
      notes = notes.replace(/\[UID:(?:UID|\{UID\}|UNIVERSAL|NEW|ONBOARD)\]/gi, '').trim() || null;
      changed = true;
    }

    if (hardware_uid && isUniversalOnboardingTag(hardware_uid)) {
      hardware_uid = null;
      changed = true;
    }

    if (isUniversalOnboardingTag(tag_id)) {
      const idParsed = parseTagId(g.id);
      tag_id = idParsed.tagNumber
        ? `TAG-${idParsed.tagNumber.toString().padStart(3, '0')}`
        : g.id.replace('GUEST', 'TAG');
      changed = true;
    }

    if (changed) {
      const cleaned = { ...g, notes, hardware_uid, tag_id };
      dirtyGuests.push(cleaned);
      return cleaned;
    }
    return g;
  });

  return { sanitized, dirtyGuests };
}

const STORAGE_KEY_SETTINGS = 'halloween_party_settings_v1';
const STORAGE_KEY_GUESTS = 'halloween_party_guests_v1';
const STORAGE_KEY_LOGS = 'halloween_party_logs_v1';

const initialSettings: PartySettings = {
  id: 'default_party',
  party_name: 'Halloween Birthday Party 2026',
  default_drink_limit: 5,
  is_party_active: true,
  admin_pin: '2113',
  cutoff_time: null,
};

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
    if (raw) {
      const p = JSON.parse(raw);
      if (p.admin_pin === '1031') p.admin_pin = '2113';
      settings = { ...initialSettings, ...p };
    }
  } catch {
    // fallback
  }

  let guests: Guest[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GUESTS);
    if (raw) {
      guests = sanitizeLegacyUidGuests(JSON.parse(raw)).sanitized;
    }
  } catch {
    // fallback
  }

  if (!guests || guests.length === 0) {
    guests = generateWristbandBatch(100);
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
let globalSelectedGuestId: string | null = null;
let globalIsSearchOpen = false;
let isInitialized = false;
let isSyncingGlobal = false;
let isRealtimeInitialized = false;

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
 * Singleton background synchronization with Supabase
 */
async function syncFromSupabaseGlobal() {
  if (!isSupabaseConfigured || !supabase || isSyncingGlobal) return;
  try {
    isSyncingGlobal = true;
    const [settingsRes, guestsRes, logsRes] = await Promise.all([
      supabase.from('party_settings').select('*').single(),
      supabase.from('guests').select('*').order('id', { ascending: true }),
      supabase.from('drink_logs').select('*').order('served_at', { ascending: false }).limit(1000),
    ]);

    if (settingsRes.data) {
      const s = { ...initialSettings, ...settingsRes.data };
      if (s.admin_pin === '1031') s.admin_pin = '2113';
      globalSettings = s;
    }
    if (guestsRes.data && guestsRes.data.length > 0) {
      const { sanitized, dirtyGuests } = sanitizeLegacyUidGuests(guestsRes.data);
      globalGuests = sanitized;

      // Persist cleanup of any legacy [UID:UID] rows back to Supabase so they never re-trigger
      if (dirtyGuests.length > 0 && supabase) {
        const sb = supabase;
        Promise.allSettled(
          dirtyGuests.map(dg =>
            sb
              .from('guests')
              .update({ notes: dg.notes, tag_id: dg.tag_id })
              .eq('id', dg.id)
          )
        ).catch(() => {});
      }
    }
    if (logsRes.data) globalLogs = logsRes.data;

    persistLocalState();
    notifySubscribers();
  } catch (err) {
    console.warn('Supabase sync fallback to local storage:', err);
  } finally {
    isSyncingGlobal = false;
  }
}

/**
 * Singleton Realtime subscription
 */
function initGlobalRealtime() {
  if (isRealtimeInitialized || typeof window === 'undefined' || !isSupabaseConfigured || !supabase) return;
  isRealtimeInitialized = true;

  try {
    supabase
      .channel('party_realtime_singleton')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guests' }, () => {
        syncFromSupabaseGlobal();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drink_logs' }, () => {
        syncFromSupabaseGlobal();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_settings' }, () => {
        syncFromSupabaseGlobal();
      })
      .subscribe((status, err) => {
        if (err) {
          console.warn('[Realtime] Subscription error:', status, err);
        }
      });

    // Also auto-refresh when browser window refocuses or wakes up from lock
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncFromSupabaseGlobal();
      }
    });
    window.addEventListener('focus', () => {
      syncFromSupabaseGlobal();
    });
  } catch (err) {
    console.warn('[Realtime] Setup exception caught:', err);
  }
}

/**
 * Core Party Store Hook
 */
export function usePartyStore() {
  const [, setTick] = useState(0);

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

    // Initialize singleton remote sync & realtime once
    if (isSupabaseConfigured && supabase) {
      syncFromSupabaseGlobal();
      initGlobalRealtime();
    }

    return () => {
      listeners.delete(rerender);
    };
  }, []);

  const setSelectedGuestId = useCallback((guestId: string | null) => {
    globalSelectedGuestId = guestId;
    notifySubscribers();
  }, []);

  const setIsSearchOpen = useCallback((open: boolean) => {
    globalIsSearchOpen = open;
    notifySubscribers();
  }, []);

  /**
   * Directly fetches a guest by tag from Supabase, syncing with local memory.
   * Returns null immediately for universal onboarding placeholders ({UID}).
   */
  const fetchGuestByTag = useCallback(async (tagSearch: string): Promise<Guest | null> => {
    if (!tagSearch || isUniversalOnboardingTag(tagSearch)) {
      return null;
    }

    // 1. Check in-memory first
    const memoryMatch = findGuestByTag(globalGuests, tagSearch);
    if (memoryMatch && memoryMatch.name && memoryMatch.is_entered) {
      return memoryMatch;
    }

    // 2. Query Supabase directly for authoritative state
    if (isSupabaseConfigured && supabase) {
      try {
        const parsed = parseTagId(tagSearch);
        if (parsed.isUniversal) return null;

        const queryOrConditions = [
          `tag_id.eq.${parsed.canonicalTag}`,
          `tag_id.eq.${parsed.decoded}`,
          `tag_id.ilike.${parsed.canonicalTag}%`,
          `id.eq.${parsed.canonicalTag.replace('TAG', 'GUEST')}`,
        ];

        if (
          parsed.cleanAlphanumeric &&
          !isUniversalOnboardingTag(parsed.cleanAlphanumeric) &&
          parsed.cleanAlphanumeric.length >= 4
        ) {
          queryOrConditions.push(`notes.ilike.%${parsed.cleanAlphanumeric}%`);
        }

        const { data, error } = await supabase
          .from('guests')
          .select('*')
          .or(queryOrConditions.join(','))
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          const [guest] = sanitizeLegacyUidGuests([data as Guest]).sanitized;
          const idx = globalGuests.findIndex(g => g.id === guest.id || g.tag_id === guest.tag_id);
          if (idx >= 0) {
            globalGuests[idx] = guest;
            globalGuests = [...globalGuests];
          } else {
            globalGuests = [guest, ...globalGuests];
          }
          persistLocalState();
          return guest;
        }
      } catch (err) {
        console.warn('Error fetching guest from Supabase:', err);
      }
    }

    return memoryMatch || null;
  }, []);

  /**
   * Serve Drink action (called by Barman or staff on /t/[id])
   */
  const serveDrink = useCallback(
    async (tagId: string, drinkType: DrinkType = 'beer'): Promise<ServeDrinkResult> => {
      let guest = findGuestByTag(globalGuests, tagId);

      if (!guest && isSupabaseConfigured && supabase) {
        guest = (await fetchGuestByTag(tagId)) || undefined;
      }

      if (!guest) {
        soundSystem.playErrorSound();
        return {
          success: false,
          error: 'GUEST_NOT_FOUND',
          message: `Wristband '${tagId}' is not registered in the system.`,
        };
      }

      // If guest hasn't entered yet, auto-check them in with placeholder name
      let activeGuest = guest;
      if (!activeGuest.is_entered) {
        activeGuest = {
          ...activeGuest,
          is_entered: true,
          entered_at: new Date().toISOString(),
          name: activeGuest.name || `Guest (${guest.tag_id})`,
        };
      }

      globalSelectedGuestId = activeGuest.id;
      const result = processDrinkRequest(activeGuest, globalSettings, drinkType);

      if (result.success && result.guest) {
        const newGuest = result.guest;
        globalGuests = globalGuests.map(g => (g.id === newGuest.id ? newGuest : g));

        const newLog: DrinkLog = {
          id: generateUuid(),
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

        // Push to Supabase and await confirmation
        if (isSupabaseConfigured && supabase) {
          try {
            await Promise.allSettled([
              supabase
                .from('guests')
                .update({
                  drinks_consumed: newGuest.drinks_consumed,
                  updated_at: newGuest.updated_at,
                  is_entered: true,
                  name: newGuest.name,
                })
                .eq('id', newGuest.id),
              supabase.from('drink_logs').insert(newLog),
            ]);
          } catch (err) {
            console.error('Failed to sync drink serve to Supabase:', err);
          }
        }
      } else {
        notifySubscribers();
        soundSystem.playLimitSound();
      }

      return result;
    },
    [fetchGuestByTag]
  );

  /**
   * Revert a drink for a guest (Undo action - either specific logId or most recent active log)
   */
  const revertLastDrink = useCallback(async (guestId: string, logId?: string): Promise<boolean> => {
    const guest = globalGuests.find(g => g.id === guestId || isTagMatch(g, guestId));
    if (!guest) return false;

    const actualGuestId = guest.id;
    const targetLog = logId
      ? globalLogs.find(l => l.id === logId && l.guest_id === actualGuestId && !l.is_reverted)
      : globalLogs.find(l => l.guest_id === actualGuestId && !l.is_reverted);
    if (!targetLog) return false;

    const { updatedGuest, revertedLog } = revertDrinkRequest(guest, targetLog);

    globalGuests = globalGuests.map(g => (g.id === actualGuestId ? updatedGuest : g));
    globalLogs = globalLogs.map(l => (l.id === revertedLog.id ? revertedLog : l));

    persistLocalState();
    notifySubscribers();
    soundSystem.playUndoSound();

    if (isSupabaseConfigured && supabase) {
      try {
        await Promise.allSettled([
          supabase.from('guests').update({ drinks_consumed: updatedGuest.drinks_consumed }).eq('id', actualGuestId),
          supabase.from('drink_logs').update({ is_reverted: true, reverted_at: new Date().toISOString() }).eq('id', targetLog.id),
        ]);
      } catch (err) {
        console.error('Failed to revert drink in Supabase:', err);
      }
    }

    return true;
  }, []);

  /**
   * Door Check-in & First Tap Wristband Activation
   * Supports both explicit tag IDs (TAG-004, ID-004, hardware UID) and Universal Onboarding links ({UID}).
   */
  const checkIn = useCallback(async (input: DoorCheckInInput): Promise<Guest> => {
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      throw new Error('Guest name cannot be empty');
    }

    const isUniversalInput = !input.tag_id?.trim() || isUniversalOnboardingTag(input.tag_id);

    // 1. Find existing guest in memory using fuzzy tag matching (unless universal link)
    let existingGuest = isUniversalInput
      ? getNextFreeGuestSlot(globalGuests) || undefined
      : findGuestByTag(globalGuests, input.tag_id);

    // 2. If not found in memory and not a universal link, query Supabase directly
    if (!existingGuest && !isUniversalInput && isSupabaseConfigured && supabase) {
      const parsed = parseTagId(input.tag_id);
      const queryOr = [
        `tag_id.eq.${parsed.canonicalTag}`,
        `tag_id.eq.${parsed.decoded}`,
        `tag_id.ilike.${parsed.canonicalTag}%`,
        `id.eq.${parsed.canonicalTag.replace('TAG', 'GUEST')}`,
      ];
      if (
        parsed.cleanAlphanumeric &&
        !isUniversalOnboardingTag(parsed.cleanAlphanumeric) &&
        parsed.cleanAlphanumeric.length >= 4
      ) {
        queryOr.push(`notes.ilike.%${parsed.cleanAlphanumeric}%`);
      }

      try {
        const { data } = await supabase
          .from('guests')
          .select('*')
          .or(queryOr.join(','))
          .limit(1)
          .maybeSingle();

        if (data) {
          existingGuest = sanitizeLegacyUidGuests([data as Guest]).sanitized[0];
        }
      } catch (err) {
        console.warn('Supabase lookup during check-in failed:', err);
      }
    }

    const now = new Date().toISOString();
    const parsedInput = parseTagId(existingGuest ? existingGuest.tag_id : input.tag_id);

    // If this is a non-numbered real hardware UID tag (not universal) and not yet assigned, claim the next free slot (GUEST-001..100)
    const rawHwCandidate =
      input.hardware_uid ||
      (!isUniversalInput && parsedInput.tagNumber === null ? parsedInput.cleanAlphanumeric : undefined);

    const effectiveHwUid =
      rawHwCandidate && !isUniversalOnboardingTag(rawHwCandidate) && rawHwCandidate.length >= 4
        ? rawHwCandidate
        : undefined;

    if (!existingGuest && parsedInput.tagNumber === null) {
      const freeSlot = getNextFreeGuestSlot(globalGuests);
      if (freeSlot) {
        existingGuest = freeSlot;
      }
    }

    // Encode hardware UID in notes if provided for persistent chip matching
    const cleanInputNotes = (input.notes ?? existingGuest?.notes ?? '')
      .replace(/\[UID:[^\]]+\]/gi, '')
      .trim();

    let finalNotes: string | null = cleanInputNotes || null;
    if (effectiveHwUid) {
      const cleanUid = effectiveHwUid.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      finalNotes = cleanInputNotes ? `[UID:${cleanUid}] ${cleanInputNotes}` : `[UID:${cleanUid}]`;
    }

    let updatedGuest: Guest;

    if (existingGuest) {
      updatedGuest = {
        ...existingGuest,
        hardware_uid: effectiveHwUid || existingGuest.hardware_uid || null,
        name: trimmedName,
        category: input.category || existingGuest.category || 'standard',
        custom_drink_limit:
          input.custom_drink_limit !== undefined ? input.custom_drink_limit : existingGuest.custom_drink_limit,
        is_entered: true,
        entered_at: existingGuest.entered_at || now,
        notes: finalNotes,
        updated_at: now,
      };
    } else {
      const fallbackSlotNum = globalGuests.length + 1;
      const resolvedNum = parsedInput.tagNumber ?? fallbackSlotNum;
      const newGuestId = `GUEST-${resolvedNum.toString().padStart(3, '0')}`;
      const newTagId = `TAG-${resolvedNum.toString().padStart(3, '0')}`;

      updatedGuest = {
        id: newGuestId,
        tag_id: newTagId,
        hardware_uid: effectiveHwUid || null,
        name: trimmedName,
        category: input.category || 'standard',
        custom_drink_limit: input.custom_drink_limit ?? null,
        drinks_consumed: 0,
        is_entered: true,
        entered_at: now,
        is_blocked: false,
        notes: finalNotes,
        created_at: now,
        updated_at: now,
      };
    }

    // 3. Write to Supabase with resilient update/upsert
    if (isSupabaseConfigured && supabase) {
      try {
        const dbPayload = {
          name: updatedGuest.name,
          category: updatedGuest.category,
          is_entered: true,
          entered_at: updatedGuest.entered_at,
          custom_drink_limit: updatedGuest.custom_drink_limit,
          notes: updatedGuest.notes,
          updated_at: now,
        };

        if (existingGuest?.id) {
          const { error: updateError } = await supabase
            .from('guests')
            .update(dbPayload)
            .eq('id', existingGuest.id);

          if (updateError) {
            console.error('Supabase update error during checkIn:', updateError);
          }
        } else {
          const { error: upsertError } = await supabase
            .from('guests')
            .upsert({
              id: updatedGuest.id,
              tag_id: updatedGuest.tag_id,
              drinks_consumed: 0,
              is_blocked: false,
              ...dbPayload,
              created_at: now,
            }, { onConflict: 'id' });

          if (upsertError) {
            console.error('Supabase upsert error during checkIn:', upsertError);
          }
        }
      } catch (err) {
        console.error('Supabase write error during checkIn:', err);
      }
    }

    // 4. Update memory state
    const index = globalGuests.findIndex(
      g =>
        g.id === updatedGuest.id ||
        g.tag_id === updatedGuest.tag_id ||
        (!isUniversalInput && isTagMatch(g, input.tag_id))
    );

    if (index >= 0) {
      globalGuests[index] = updatedGuest;
      globalGuests = [...globalGuests];
    } else {
      globalGuests = [updatedGuest, ...globalGuests];
    }

    globalSelectedGuestId = updatedGuest.id;
    persistLocalState();
    notifySubscribers();
    soundSystem.playApprovedSound();

    return updatedGuest;
  }, []);

  /**
   * Update Guest properties (Name, custom limit, notes, category, blocked)
   * Only callable from Admin Panel
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
      try {
        const { id, name, category, custom_drink_limit, drinks_consumed, is_entered, entered_at, is_blocked, notes } = updates;
        const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (name !== undefined) dbUpdates.name = name;
        if (category !== undefined) dbUpdates.category = category;
        if (custom_drink_limit !== undefined) dbUpdates.custom_drink_limit = custom_drink_limit;
        if (drinks_consumed !== undefined) dbUpdates.drinks_consumed = drinks_consumed;
        if (is_entered !== undefined) dbUpdates.is_entered = is_entered;
        if (entered_at !== undefined) dbUpdates.entered_at = entered_at;
        if (is_blocked !== undefined) dbUpdates.is_blocked = is_blocked;
        if (notes !== undefined) dbUpdates.notes = notes;

        await supabase.from('guests').update(dbUpdates).eq('id', id);
      } catch (err) {
        console.error('Failed to update guest in Supabase:', err);
      }
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
      try {
        await supabase
          .from('party_settings')
          .update({
            party_name: globalSettings.party_name,
            default_drink_limit: globalSettings.default_drink_limit,
            is_party_active: globalSettings.is_party_active,
            admin_pin: globalSettings.admin_pin,
            cutoff_time: globalSettings.cutoff_time,
            updated_at: globalSettings.updated_at,
          })
          .eq('id', globalSettings.id || 'default_party');
      } catch (err) {
        console.error('Failed to update settings in Supabase:', err);
      }
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
    globalSelectedGuestId = null;

    persistLocalState();
    notifySubscribers();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('drink_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('guests').delete().neq('id', 'NONE');
        await supabase.from('guests').insert(globalGuests);
      } catch (err) {
        console.error('Failed to reset party in Supabase:', err);
      }
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
    selectedGuestId: globalSelectedGuestId,
    setSelectedGuestId,
    isSearchOpen: globalIsSearchOpen,
    setIsSearchOpen,
    isSyncing: isSyncingGlobal,
    isSupabaseConnected: isSupabaseConfigured,
    serveDrink,
    revertLastDrink,
    checkIn,
    updateGuest,
    updateSettings,
    resetParty,
    exportCsv,
    refresh: syncFromSupabaseGlobal,
    fetchGuestByTag,
  };
}
