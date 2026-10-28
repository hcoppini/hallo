'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UserCheck,
  Loader2,
  X,
  ChevronDown,
  AlertCircle,
  Radio,
  Sliders,
  Users,
  Search,
  Check,
  Sparkles,
  Car,
} from 'lucide-react';
import { Guest, GuestCategory, PartySettings, DoorCheckInInput, ImportedGuest } from '@/lib/types';
import { usePartyStore } from '@/lib/store';
import { searchGuestRoster } from '@/lib/guest-import-utils';
import {
  parseTagId,
  getNextFreeTagId,
  isUniversalOnboardingTag,
  stripUidFromNotes,
  findGuestByTag,
} from '@/lib/tag-utils';
import { isWebNfcSupported, nfcController } from '@/lib/nfc';
import { soundSystem } from '@/lib/audio';

interface GuestOnboardingCardProps {
  targetTagId: string;
  isUniversalLink?: boolean;
  guests: Guest[];
  settings: PartySettings;
  onTargetTagChange?: (newTagId: string) => void;
  onCheckIn: (input: DoorCheckInInput) => Promise<Guest>;
  onComplete?: (guest: Guest, wroteNfc: boolean) => void;
  selectedRosterGuest?: ImportedGuest | null;
}

export function GuestOnboardingCard({
  targetTagId,
  isUniversalLink = false,
  guests,
  settings,
  onTargetTagChange,
  onCheckIn,
  onComplete,
  selectedRosterGuest,
}: GuestOnboardingCardProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nextFreeTag = useMemo(() => getNextFreeTagId(guests), [guests]);

  const effectiveTagId = useMemo(() => {
    if (!targetTagId || isUniversalOnboardingTag(targetTagId)) {
      return nextFreeTag;
    }
    const parsed = parseTagId(targetTagId);
    return parsed.canonicalTag || targetTagId.toUpperCase();
  }, [targetTagId, nextFreeTag]);

  const existingGuestForSlot = useMemo(
    () => findGuestByTag(guests, effectiveTagId),
    [guests, effectiveTagId]
  );

  const [name, setName] = useState('');
  const [category, setCategory] = useState<GuestCategory>('standard');
  const [drinkLimit, setDrinkLimit] = useState<number>(settings.default_drink_limit);
  const [isCustomLimit, setIsCustomLimit] = useState(false);
  const [notes, setNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { importedGuests } = usePartyStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Suggestions for autocomplete
  const suggestions = useMemo(() => {
    if (!importedGuests || importedGuests.length === 0) return [];
    return searchGuestRoster(importedGuests, name, 6);
  }, [importedGuests, name]);

  const pendingRosterCount = useMemo(() => {
    return (importedGuests || []).filter(g => !g.is_checked_in).length;
  }, [importedGuests]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  const selectRosterGuest = (rosterGuest: ImportedGuest) => {
    setName(rosterGuest.name);
    if (rosterGuest.category) {
      setCategory(rosterGuest.category);
    }
    if (rosterGuest.notes) {
      setNotes(rosterGuest.notes);
      setShowAdvanced(true);
    }
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    soundSystem.playApprovedSound();
    nameInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsDropdownOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        e.preventDefault();
        selectRosterGuest(suggestions[highlightedIndex]);
      }
      // If highlightedIndex is -1, Enter normally submits the form!
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNfcWriting, setIsNfcWriting] = useState(false);
  const [isNfcSupported, setIsNfcSupported] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsNfcSupported(isWebNfcSupported());
  }, []);

  // Pre-populate if selecting an existing guest slot that already has data, or reset for new slot
  useEffect(() => {
    if (existingGuestForSlot && existingGuestForSlot.name && existingGuestForSlot.is_entered) {
      setName(existingGuestForSlot.name);
      setCategory(existingGuestForSlot.category || 'standard');
      if (
        existingGuestForSlot.custom_drink_limit !== null &&
        existingGuestForSlot.custom_drink_limit !== undefined
      ) {
        setDrinkLimit(existingGuestForSlot.custom_drink_limit);
        setIsCustomLimit(true);
      } else {
        setDrinkLimit(settings.default_drink_limit);
        setIsCustomLimit(false);
      }
      setNotes(stripUidFromNotes(existingGuestForSlot.notes));
    } else {
      setName('');
      setCategory('standard');
      setDrinkLimit(settings.default_drink_limit);
      setIsCustomLimit(false);
      setNotes('');
      setErrorMsg(null);
    }
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 60);
  }, [effectiveTagId, existingGuestForSlot, settings.default_drink_limit]);

  // Pre-populate if a guest was selected from the expected roster
  useEffect(() => {
    if (selectedRosterGuest) {
      setName(selectedRosterGuest.name);
      setCategory(selectedRosterGuest.category || 'standard');
      if (selectedRosterGuest.notes) {
        setNotes(selectedRosterGuest.notes);
        setShowAdvanced(true);
      }
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [selectedRosterGuest]);

  const executeOnboarding = async (shouldWriteNfc: boolean) => {
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter the guest’s name or nickname.');
      soundSystem.playErrorSound();
      nameInputRef.current?.focus();
      return;
    }

    const finalTagId = effectiveTagId;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const targetUrl = `${baseUrl}/t/${finalTagId}`;

    if (shouldWriteNfc && isNfcSupported) {
      try {
        setIsNfcWriting(true);
        await nfcController.writeUrl(targetUrl);
        setIsNfcWriting(false);
      } catch (err) {
        setIsNfcWriting(false);
        setErrorMsg(
          err instanceof Error
            ? `NFC Sticker Write Error: ${err.message}`
            : 'Could not write to NFC sticker. Hold sticker firmly against phone and try again.'
        );
        soundSystem.playErrorSound();
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const resolvedCustomLimit =
        category === 'standard'
          ? isCustomLimit
            ? drinkLimit
            : null
          : category === 'driver_minor'
          ? 0
          : null;

      const checkedGuest = await onCheckIn({
        tag_id: finalTagId,
        name: name.trim(),
        category,
        custom_drink_limit: resolvedCustomLimit,
        notes: notes.trim() || undefined,
      });

      setIsSubmitting(false);

      // Reset form fields immediately for next guest
      setName('');
      setCategory('standard');
      setDrinkLimit(settings.default_drink_limit);
      setIsCustomLimit(false);
      setNotes('');
      setShowAdvanced(false);
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);

      // Refocus name input immediately
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);

      onComplete?.(checkedGuest, shouldWriteNfc);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      soundSystem.playErrorSound();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeOnboarding(false);
  };

  const parsedEffective = useMemo(() => parseTagId(effectiveTagId), [effectiveTagId]);
  const slotNumber = parsedEffective.tagNumber;

  return (
    <div className="glass-card p-4 sm:p-5 border border-black/15 shadow-lg relative overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/10">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <h2 className="font-display text-2xl sm:text-3xl font-bold lowercase text-black leading-none">
            {existingGuestForSlot?.is_entered ? 'edit guest' : 'register guest'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-black text-white font-mono text-xs font-bold tracking-wider shrink-0">
            {slotNumber !== null ? `Wristband #${slotNumber}` : effectiveTagId}
          </span>
        </div>

        {isNfcSupported && (
          <button
            type="button"
            onClick={() => executeOnboarding(true)}
            disabled={isSubmitting || isNfcWriting}
            className="text-[11px] font-sans-clean font-semibold text-black/60 hover:text-black flex items-center gap-1 cursor-pointer"
            title="Write to physical NFC sticker on registration"
          >
            <Radio className="w-3.5 h-3.5 text-black/50" />
            <span className="hidden sm:inline">write nfc</span>
          </button>
        )}
      </div>

      {/* Prominent Prompt When Creating New Guest */}
      {!existingGuestForSlot?.is_entered && (
        <div className="p-3 mb-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-950 flex items-center justify-between gap-2 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-sans-clean text-xs font-bold truncate">
              Wristband {slotNumber !== null ? `#${slotNumber}` : effectiveTagId} ready — enter guest name to register
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
            Unregistered
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 mb-3 rounded-xl bg-red-50 text-red-800 text-xs font-sans-clean flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-0.5 text-red-600 hover:text-red-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Roster Telemetry Banner when imported guests exist */}
        {importedGuests.length > 0 && (
          <div className="flex items-center justify-between text-[11px] font-sans-clean text-black/55 px-1">
            <span className="flex items-center gap-1.5 font-semibold text-black/70">
              <Users className="w-3.5 h-3.5 text-black/45" />
              <span>{pendingRosterCount} expected guest{pendingRosterCount === 1 ? '' : 's'} on roster</span>
            </span>
            <span className="text-[10px] text-black/45 lowercase">type to autofill or select below</span>
          </div>
        )}

        {/* Responsive Name & Category Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          {/* Guest Name Input */}
          <div className="sm:col-span-8 relative">
            <input
              ref={nameInputRef}
              type="text"
              required
              autoFocus
              placeholder={slotNumber !== null ? `Guest name for Wristband #${slotNumber}...` : "Guest name or nickname..."}
              value={name}
              onChange={e => {
                setName(e.target.value);
                setIsDropdownOpen(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => {
                if (importedGuests.length > 0 && name.trim()) {
                  setIsDropdownOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
              className="w-full px-3.5 py-3 pr-9 bg-black/[0.035] border border-black/15 rounded-xl font-sans-clean text-sm sm:text-base font-semibold text-black placeholder:text-black/35 placeholder:font-normal outline-none focus:bg-white focus:border-black transition-all"
            />
            {name && (
              <button
                type="button"
                onClick={() => {
                  setName('');
                  setIsDropdownOpen(false);
                  setHighlightedIndex(-1);
                  nameInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-black/35 hover:text-black hover:bg-black/5"
                title="Clear name"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown (Standard pre-selected, VIP, Driver) */}
          <div className="sm:col-span-4 relative">
            <select
              value={category}
              onChange={e => {
                const val = e.target.value as GuestCategory;
                setCategory(val);
                soundSystem.vibrate(10);
              }}
              className="w-full appearance-none px-3.5 py-3 pr-8 bg-black/[0.035] hover:bg-black/[0.06] border border-black/15 rounded-xl font-sans-clean text-xs sm:text-sm font-bold text-black outline-none focus:bg-white focus:border-black transition-all cursor-pointer"
            >
              <option value="standard">Standard</option>
              <option value="vip">VIP</option>
              <option value="driver_minor">Driver</option>
            </select>
            <ChevronDown className="w-4 h-4 text-black/50 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* IN-FLOW Autocomplete Suggestions: smoothly expands between input and button. NEVER COVERS THE BUTTON! */}
        {isDropdownOpen && importedGuests.length > 0 && name.trim().length > 0 && (
          <div
            ref={dropdownRef}
            className="rounded-2xl border border-black/15 bg-white overflow-hidden shadow-xs animate-in fade-in duration-100 max-h-48 overflow-y-auto"
          >
            {suggestions.length > 0 ? (
              <div className="p-1 divide-y divide-black/5">
                <div className="px-3 py-1.5 text-[10px] font-sans-clean font-bold uppercase tracking-wider text-black/45 flex items-center justify-between bg-black/[0.02]">
                  <span>matching guests ({suggestions.length})</span>
                  <span className="font-normal lowercase">click or press Enter to autofill</span>
                </div>
                {suggestions.map((suggestion, index) => {
                  const isHighlighted = highlightedIndex === index;
                  return (
                    <button
                      key={suggestion.id}
                      type="button"
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => selectRosterGuest(suggestion)}
                      className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isHighlighted ? 'bg-black text-white' : 'hover:bg-black/5 text-black'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-sans-clean text-xs sm:text-sm font-bold block truncate">
                          {suggestion.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {suggestion.category === 'vip' && (
                            <span
                              className={`text-[9px] font-sans-clean px-1.5 py-0.2 rounded font-bold uppercase ${
                                isHighlighted ? 'bg-amber-400 text-black' : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              VIP
                            </span>
                          )}
                          {suggestion.category === 'driver_minor' && (
                            <span
                              className={`text-[9px] font-sans-clean px-1.5 py-0.2 rounded font-bold uppercase ${
                                isHighlighted ? 'bg-blue-300 text-black' : 'bg-blue-100 text-blue-900'
                              }`}
                            >
                              Driver
                            </span>
                          )}
                          {suggestion.notes && (
                            <span
                              className={`text-[11px] truncate max-w-[120px] ${
                                isHighlighted ? 'text-white/70' : 'text-black/40'
                              }`}
                            >
                              {suggestion.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {suggestion.is_checked_in ? (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                              isHighlighted ? 'bg-white/20 text-white' : 'bg-black/5 text-black/50'
                            }`}
                          >
                            {suggestion.checked_in_tag_id || 'Checked in'}
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-sans-clean font-semibold flex items-center gap-1 ${
                              isHighlighted ? 'bg-emerald-400 text-black' : 'bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>autofill</span>
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* If no name in roster matches */
              <div className="p-2.5 text-center bg-black/[0.01]">
                <span className="text-xs font-sans-clean text-black/60 block font-semibold">
                  &ldquo;{name}&rdquo; is not on the imported roster
                </span>
                <span className="text-[11px] font-sans-clean text-black/40 block mt-0.5">
                  Click &quot;register guest&quot; below to add them as a walk-in attendee.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Primary Action Button (Zero scroll, visible immediately) */}
        <button
          type="submit"
          disabled={isSubmitting || isNfcWriting}
          className="btn-premium-primary w-full py-3.5 sm:py-4 text-xs sm:text-sm gap-2 shadow-md cursor-pointer justify-center"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserCheck className="w-4 h-4" />
          )}
          <span>
            {isSubmitting
              ? 'registering guest...'
              : existingGuestForSlot?.is_entered
              ? 'save guest profile'
              : 'register guest'}
          </span>
        </button>

        {/* Collapsed Advanced Options (Toggled only if staff explicitly wants notes or custom limit) */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowAdvanced(prev => !prev)}
            className="text-[11px] font-sans-clean text-black/45 hover:text-black transition-colors flex items-center gap-1 cursor-pointer mx-auto"
          >
            <Sliders className="w-3 h-3" />
            <span>{showAdvanced ? 'hide extra options' : 'extra options (notes, custom limit)'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-2.5 p-3 rounded-xl bg-black/[0.025] border border-black/10 space-y-2.5 animate-in fade-in duration-100 text-xs">
              {category === 'standard' && (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans-clean font-semibold text-black/70">
                    Custom drink limit:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[3, 5, 8, 10].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setDrinkLimit(val);
                          setIsCustomLimit(true);
                        }}
                        className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold border transition-colors ${
                          isCustomLimit && drinkLimit === val
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-black/70 border-black/15'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                    {isCustomLimit && (
                      <button
                        type="button"
                        onClick={() => {
                          setDrinkLimit(settings.default_drink_limit);
                          setIsCustomLimit(false);
                        }}
                        className="text-[10px] text-black/50 underline ml-1"
                      >
                        reset
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <input
                  type="text"
                  placeholder="Optional notes / care details..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-black/15 rounded-lg font-sans-clean text-xs text-black placeholder:text-black/30 outline-none focus:border-black"
                />
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Android Web NFC Writing Overlay */}
      {isNfcWriting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="max-w-xs w-full p-6 rounded-3xl bg-white text-center shadow-2xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center mx-auto animate-pulse">
              <Radio className="w-6 h-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-black lowercase">
              hold sticker to phone
            </h3>
            <p className="font-sans-clean text-xs text-black/60 leading-relaxed">
              Hold wristband sticker against your phone to register <strong>{name}</strong>.
            </p>
            <button
              type="button"
              onClick={() => setIsNfcWriting(false)}
              className="py-1.5 px-3 rounded-xl text-xs font-sans-clean text-black/50 hover:text-black flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>cancel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
