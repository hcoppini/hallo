'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserCheck,
  Sparkles,
  Beer,
  Car,
  Minus,
  Plus,
  AlertCircle,
  Loader2,
  Radio,
  X,
  ChevronDown,
  ChevronUp,
  Lock,
  Tag,
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

const QUICK_NOTE_TAGS = ['Birthday Crew', 'VIP Friend', 'Plus One', 'Allergy / Care'];

export function GuestOnboardingCard({
  targetTagId,
  isUniversalLink = false,
  guests,
  settings,
  onTargetTagChange,
  onCheckIn,
  onComplete,
}: GuestOnboardingCardProps) {
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
  const [isSlotPickerOpen, setIsSlotPickerOpen] = useState(false);
  const [manualSlotInput, setManualSlotInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNfcWriting, setIsNfcWriting] = useState(false);
  const [isNfcSupported, setIsNfcSupported] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setIsNfcSupported(isWebNfcSupported());
  }, []);

  // Keep drinkLimit synced with settings.default_drink_limit when not customized
  useEffect(() => {
    if (!isCustomLimit) {
      setDrinkLimit(settings.default_drink_limit);
    }
  }, [settings.default_drink_limit, isCustomLimit]);

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

  const parsedTarget = parseTagId(effectiveTagId);
  const displaySlotNumber = parsedTarget.tagNumber
    ? `#${parsedTarget.tagNumber.toString().padStart(3, '0')}`
    : effectiveTagId;

  const freeSlots = useMemo(
    () =>
      guests
        .filter(g => !g.is_entered && (!g.name || g.name.trim() === ''))
        .slice(0, 12),
    [guests]
  );

  const handleLimitChange = (newLimit: number) => {
    const clamped = Math.max(1, Math.min(25, newLimit));
    setDrinkLimit(clamped);
    setIsCustomLimit(clamped !== settings.default_drink_limit);
    soundSystem.vibrate(10);
  };

  const handleToggleQuickNote = (tag: string) => {
    soundSystem.vibrate(10);
    const current = notes.trim();
    if (current.toLowerCase().includes(tag.toLowerCase())) {
      const cleaned = current
        .replace(new RegExp(`(?:^|,\\s*|\\s*•\\s*)${tag}`, 'i'), '')
        .replace(/^[,•\s]+|[,•\s]+$/g, '')
        .trim();
      setNotes(cleaned);
    } else {
      setNotes(current ? `${current} • ${tag}` : tag);
    }
  };

  const handleSelectSlot = (newTag: string) => {
    const parsed = parseTagId(newTag);
    const canonical = parsed.canonicalTag || newTag.trim().toUpperCase();
    if (canonical && !isUniversalOnboardingTag(canonical)) {
      onTargetTagChange?.(canonical);
      setIsSlotPickerOpen(false);
      setManualSlotInput('');
    }
  };

  const executeOnboarding = async (shouldWriteNfc: boolean) => {
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter the guest’s name or nickname.');
      soundSystem.playErrorSound();
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

      // Reset form fields for next guest if staying on /door
      setName('');
      setCategory('standard');
      setDrinkLimit(settings.default_drink_limit);
      setIsCustomLimit(false);
      setNotes('');

      onComplete?.(checkedGuest, shouldWriteNfc);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err instanceof Error ? err.message : 'Onboarding failed. Please try again.');
      soundSystem.playErrorSound();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeOnboarding(false);
  };

  return (
    <div className="glass-card p-6 sm:p-8 border border-black/15 shadow-xl relative overflow-hidden">
      {/* Top Identity & Slot Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-5 mb-6 border-b border-black/10">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/50">
              {isUniversalLink
                ? 'UNIVERSAL ONBOARDING LINK (/t/{UID})'
                : existingGuestForSlot?.is_entered
                ? 'UPDATE ACTIVE WRISTBAND'
                : 'NEW WRISTBAND ONBOARDING'}
            </span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold lowercase text-black leading-none">
            {existingGuestForSlot?.is_entered ? 'edit guest pass' : 'onboard guest'}
          </h2>
        </div>

        {/* Target Wristband Slot Pill + Change Slot Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSlotPickerOpen(prev => !prev)}
            className="px-3.5 py-2 rounded-2xl bg-black text-white font-mono text-xs font-bold flex items-center gap-2 shadow-sm hover:bg-black/85 transition-all cursor-pointer"
            title="Click to choose a different wristband number"
          >
            <Tag className="w-3.5 h-3.5 text-emerald-400" />
            <span>{effectiveTagId}</span>
            <span className="text-[10px] text-white/60 font-sans-clean">({displaySlotNumber})</span>
            {onTargetTagChange &&
              (isSlotPickerOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-white/70" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-white/70" />
              ))}
          </button>
        </div>
      </div>

      {/* Expandable Slot Selector (if host wants a specific band number instead of auto-assigned) */}
      {isSlotPickerOpen && onTargetTagChange && (
        <div className="p-4 mb-6 rounded-2xl bg-black/[0.03] border border-black/10 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-black/55">
              SELECT WRISTBAND SLOT NUMBER
            </span>
            {effectiveTagId !== nextFreeTag && (
              <button
                type="button"
                onClick={() => handleSelectSlot(nextFreeTag)}
                className="text-[11px] font-sans-clean font-semibold text-black underline"
              >
                auto next free ({nextFreeTag})
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {freeSlots.map(slot => {
              const isSelected = slot.tag_id === effectiveTagId;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => handleSelectSlot(slot.tag_id)}
                  className={`px-2.5 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black/75 border-black/10 hover:border-black/30'
                  }`}
                >
                  {slot.tag_id}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              placeholder="Or type band # (e.g. 14 or TAG-014)..."
              value={manualSlotInput}
              onChange={e => setManualSlotInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (manualSlotInput.trim()) handleSelectSlot(manualSlotInput);
                }
              }}
              className="flex-1 px-3 py-2 bg-white border border-black/15 rounded-xl font-mono text-xs uppercase text-black outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={() => {
                if (manualSlotInput.trim()) handleSelectSlot(manualSlotInput);
              }}
              className="btn-premium py-2 px-4 text-xs"
            >
              set slot
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 mb-5 rounded-2xl bg-red-50 text-red-800 text-xs font-sans-clean flex items-center gap-2.5 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ================================================================ */}
        {/* STEP 1: GUEST NAME / NICKNAME                                    */}
        {/* ================================================================ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/50">
              01 // GUEST NAME OR NICKNAME
            </label>
            <span className="text-[11px] font-sans-clean text-black/40 lowercase">
              required
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Janek Smagieł"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3.5 pr-10 bg-black/[0.035] border border-black/15 rounded-2xl font-sans-clean text-base font-semibold text-black placeholder:text-black/30 placeholder:font-normal outline-none focus:bg-white focus:border-black transition-all"
            />
            {name && (
              <button
                type="button"
                onClick={() => setName('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-black/35 hover:text-black hover:bg-black/5"
                title="Clear name"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* STEP 2: GUEST CATEGORY & REACTIVE DRINK LIMIT                    */}
        {/* ================================================================ */}
        <div className="space-y-3">
          <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/50 block">
            02 // GUEST TYPE & DRINK LIMIT
          </label>

          {/* 3 Tactile Tier Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                {
                  id: 'standard',
                  label: 'standard 18+',
                  sub: `${isCustomLimit ? drinkLimit : settings.default_drink_limit} drinks`,
                  icon: Beer,
                },
                {
                  id: 'driver_minor',
                  label: 'driver / minor',
                  sub: '0 alcohol',
                  icon: Car,
                },
                {
                  id: 'vip',
                  label: 'vip / host',
                  sub: 'unlimited ∞',
                  icon: Sparkles,
                },
              ] as const
            ).map(tier => {
              const Icon = tier.icon;
              const isSelected = category === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    soundSystem.vibrate(12);
                    setCategory(tier.id);
                  }}
                  className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer active:scale-[0.98] flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-black text-white border-black shadow-md'
                      : 'bg-white/80 hover:bg-white text-black border-black/12 hover:border-black/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon
                      className={`w-4 h-4 ${
                        isSelected ? 'text-emerald-400' : 'text-black/45'
                      }`}
                    />
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                  </div>
                  <div>
                    <span className="font-sans-clean text-xs font-bold block lowercase leading-tight">
                      {tier.label}
                    </span>
                    <span
                      className={`text-[10px] font-mono block mt-0.5 ${
                        isSelected ? 'text-white/70' : 'text-black/50'
                      }`}
                    >
                      {tier.sub}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Reactive Drink Limit Control Bar */}
          {category === 'standard' ? (
            <div className="p-4 rounded-2xl bg-black/[0.025] border border-black/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-sans-clean text-xs font-bold text-black lowercase">
                      personal drink limit
                    </span>
                    {isCustomLimit ? (
                      <span className="px-2 py-0.5 rounded-full bg-black text-white font-mono text-[9px] font-bold uppercase">
                        custom
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-black/8 text-black/55 font-mono text-[9px] font-bold uppercase">
                        party default
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-0.5">
                    max alcoholic drinks before bar cut-off
                  </span>
                </div>

                {/* Tactile - / + Steppers */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleLimitChange(drinkLimit - 1)}
                    className="w-9 h-9 rounded-xl bg-white border border-black/15 flex items-center justify-center text-black hover:bg-black/5 active:scale-95 transition-all cursor-pointer"
                    aria-label="Decrease drink limit"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-12 py-1 bg-white border border-black/15 rounded-xl font-display text-2xl font-bold text-black text-center select-none">
                    {drinkLimit}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLimitChange(drinkLimit + 1)}
                    className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center hover:bg-black/85 active:scale-95 transition-all cursor-pointer"
                    aria-label="Increase drink limit"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Limit Presets */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/6">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-sans-clean text-black/45 lowercase mr-1">
                    quick set:
                  </span>
                  {[3, 4, 5, 6, 8, 10].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleLimitChange(preset)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                        drinkLimit === preset
                          ? 'bg-black text-white'
                          : 'bg-white border border-black/10 text-black/65 hover:border-black/30'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {isCustomLimit && (
                  <button
                    type="button"
                    onClick={() => {
                      setDrinkLimit(settings.default_drink_limit);
                      setIsCustomLimit(false);
                    }}
                    className="text-[11px] font-sans-clean text-black/50 hover:text-black underline shrink-0"
                  >
                    reset ({settings.default_drink_limit})
                  </button>
                )}
              </div>
            </div>
          ) : category === 'driver_minor' ? (
            <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-blue-700 shrink-0" />
                <div>
                  <span className="font-sans-clean text-xs font-bold block lowercase">
                    0 alcohol safety lock active
                  </span>
                  <span className="font-sans-clean text-[11px] text-blue-800/80 block lowercase">
                    barman terminal will block alcoholic drinks and allow unlimited soft drinks.
                  </span>
                </div>
              </div>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-blue-200/70 text-blue-900 shrink-0">
                0 ALC
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                <div>
                  <span className="font-sans-clean text-xs font-bold block lowercase">
                    vip / host unlimited pass
                  </span>
                  <span className="font-sans-clean text-[11px] text-amber-800/80 block lowercase">
                    all drinks are tracked in history without triggering a bar cut-off.
                  </span>
                </div>
              </div>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-amber-200/70 text-amber-900 shrink-0">
                ∞ VIP
              </span>
            </div>
          )}
        </div>

        {/* ================================================================ */}
        {/* STEP 3: NOTES & QUICK TAGS                                       */}
        {/* ================================================================ */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/50">
              03 // NOTES & TAGS (OPTIONAL)
            </label>
          </div>

          <input
            type="text"
            placeholder="e.g. Birthday girl's friend, table 3..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-4 py-3 bg-black/[0.035] border border-black/15 rounded-2xl font-sans-clean text-xs text-black placeholder:text-black/35 outline-none focus:bg-white focus:border-black transition-all"
          />

          {/* 1-Tap Quick Note Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_NOTE_TAGS.map(tag => {
              const isActive = notes.toLowerCase().includes(tag.toLowerCase());
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleQuickNote(tag)}
                  className={`px-2.5 py-1 rounded-full font-sans-clean text-[11px] font-semibold transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-black text-white border-black'
                      : 'bg-black/[0.03] hover:bg-black/[0.07] text-black/65 border-black/10'
                  }`}
                >
                  {isActive ? `✓ ${tag}` : `+ ${tag}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================================ */}
        {/* SUBMIT CTA: SAVE & TURN INTO /t/TAG-00X                          */}
        {/* ================================================================ */}
        <div className="space-y-2.5 pt-2 border-t border-black/10">
          <button
            type="submit"
            disabled={isSubmitting || isNfcWriting}
            className="btn-premium-primary w-full py-4 text-xs sm:text-sm gap-2 shadow-xl cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            <span>
              {isSubmitting
                ? 'saving & activating pass...'
                : `save & activate pass (${effectiveTagId})`}
            </span>
          </button>

          {isNfcSupported && (
            <button
              type="button"
              onClick={() => executeOnboarding(true)}
              disabled={isSubmitting || isNfcWriting}
              className="btn-premium w-full py-3 text-xs gap-2 cursor-pointer"
            >
              {isNfcWriting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Radio className="w-4 h-4" />
              )}
              <span>
                {isNfcWriting
                  ? 'hold blank sticker to back of phone...'
                  : `save & write nfc sticker (${effectiveTagId})`}
              </span>
            </button>
          )}

          <p className="text-[11px] font-sans-clean text-black/45 text-center lowercase">
            saves guest profile and assigns pass link{' '}
            <span className="font-mono font-bold text-black/65">/t/{effectiveTagId}</span>
          </p>
        </div>
      </form>

      {/* Android Web NFC Writing Overlay */}
      {isNfcWriting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="max-w-xs w-full p-8 rounded-3xl bg-white text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center mx-auto animate-pulse">
              <Radio className="w-8 h-8" />
            </div>
            <span className="font-mono text-[10px] text-black/50 uppercase tracking-widest block">
              WRITING NFC WRISTBAND
            </span>
            <h3 className="font-display text-2xl font-bold text-black lowercase">
              hold sticker to phone
            </h3>
            <p className="font-sans-clean text-xs text-black/60 leading-relaxed">
              Hold the physical wristband sticker against your phone to write{' '}
              <strong className="font-mono">{effectiveTagId}</strong> for{' '}
              <strong>{name}</strong>.
            </p>
            <button
              type="button"
              onClick={() => setIsNfcWriting(false)}
              className="py-2 px-4 rounded-xl text-xs font-sans-clean text-black/50 hover:text-black flex items-center justify-center gap-1 mx-auto"
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
