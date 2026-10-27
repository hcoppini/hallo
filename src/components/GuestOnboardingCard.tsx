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
} from 'lucide-react';
import { Guest, GuestCategory, PartySettings, DoorCheckInInput } from '@/lib/types';
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
}

export function GuestOnboardingCard({
  targetTagId,
  isUniversalLink = false,
  guests,
  settings,
  onTargetTagChange,
  onCheckIn,
  onComplete,
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNfcWriting, setIsNfcWriting] = useState(false);
  const [isNfcSupported, setIsNfcSupported] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsNfcSupported(isWebNfcSupported());
  }, []);

  // Pre-populate if selecting an existing guest slot that already has data
  useEffect(() => {
    if (existingGuestForSlot && existingGuestForSlot.name) {
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
    }
  }, [existingGuestForSlot, settings.default_drink_limit]);

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

  return (
    <div className="glass-card p-4 sm:p-5 border border-black/15 shadow-lg relative overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-black/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="font-display text-2xl sm:text-3xl font-bold lowercase text-black leading-none">
            {existingGuestForSlot?.is_entered ? 'edit guest' : 'register guest'}
          </h2>
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
        {/* Responsive Name & Category Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          {/* Guest Name Input */}
          <div className="sm:col-span-8 relative">
            <input
              ref={nameInputRef}
              type="text"
              required
              autoFocus
              placeholder="Guest name or nickname..."
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-3 pr-9 bg-black/[0.035] border border-black/15 rounded-xl font-sans-clean text-sm sm:text-base font-semibold text-black placeholder:text-black/35 placeholder:font-normal outline-none focus:bg-white focus:border-black transition-all"
            />
            {name && (
              <button
                type="button"
                onClick={() => {
                  setName('');
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
