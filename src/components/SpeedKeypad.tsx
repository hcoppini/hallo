'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Delete, Sparkles, User, Keyboard } from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { DrinkType, Guest } from '@/lib/types';
import { findGuestByTag } from '@/lib/tag-utils';
import { calculateEffectiveLimit } from '@/lib/party-engine';

interface SpeedKeypadProps {
  onServe: (tagId: string, drinkType: DrinkType) => void;
  selectedDrinkType: DrinkType;
  onSelectGuest?: (guest: Guest) => void;
  enableKeyboardShortcuts?: boolean;
  className?: string;
}

export function SpeedKeypad({
  onServe,
  selectedDrinkType,
  onSelectGuest,
  enableKeyboardShortcuts = false,
  className = '',
}: SpeedKeypadProps) {
  const { guests, settings } = usePartyStore();
  const [digits, setDigits] = useState('');

  // Look up guest based on the currently typed digits
  const matchedGuest = useMemo<Guest | null>(() => {
    if (!digits) return null;
    const num = parseInt(digits, 10);
    if (isNaN(num)) return null;

    const formattedTag = `TAG-${num.toString().padStart(3, '0')}`;
    return findGuestByTag(guests, formattedTag) || null;
  }, [digits, guests]);

  const effectiveLimit = matchedGuest
    ? calculateEffectiveLimit(matchedGuest, settings)
    : settings.default_drink_limit;

  const isLimitReached = Boolean(
    matchedGuest &&
      matchedGuest.category !== 'vip' &&
      matchedGuest.drinks_consumed >= effectiveLimit
  );

  const handleDigit = useCallback((d: string) => {
    setDigits(prev => {
      if (prev.length >= 3) return prev;
      const next = prev + d;
      const num = parseInt(next, 10);
      if (num > 100) return prev;
      return next;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setDigits(prev => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setDigits('');
  }, []);

  const handleExecuteServe = useCallback(() => {
    if (!digits) return;
    const num = parseInt(digits, 10);
    if (isNaN(num) || num < 1) return;
    const tagToServe = matchedGuest
      ? matchedGuest.tag_id
      : `TAG-${num.toString().padStart(3, '0')}`;
    onServe(tagToServe, selectedDrinkType);
    setDigits('');
  }, [digits, matchedGuest, onServe, selectedDrinkType]);

  // Physical laptop keyboard support when enabled and no input/modal is focused
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        if (digits.length > 0) {
          e.preventDefault();
          handleBackspace();
        }
      } else if (e.key === 'Escape') {
        if (digits.length > 0) {
          e.preventDefault();
          handleClear();
        }
      } else if (e.key === 'Enter') {
        if (digits.length > 0) {
          e.preventDefault();
          handleExecuteServe();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enableKeyboardShortcuts,
    digits,
    handleDigit,
    handleBackspace,
    handleClear,
    handleExecuteServe,
  ]);

  return (
    <div
      className={`glass-card p-5 sm:p-6 border border-black/15 shadow-xl w-full max-w-sm lg:max-w-none mx-auto space-y-4 ${className}`}
    >
      {/* Header Row with Keyboard Hint on Desktop */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
          SPEED KEYPAD (#1–100)
        </span>
        {enableKeyboardShortcuts && (
          <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono text-black/45 bg-black/[0.04] px-2 py-0.5 rounded-md border border-black/8">
            <Keyboard className="w-3 h-3" />
            <span>0-9 + Enter</span>
          </span>
        )}
      </div>

      {/* Target Wristband & Match Preview Screen */}
      <div className="p-4 rounded-2xl bg-black/[0.04] border border-black/10 text-center min-h-[96px] flex flex-col justify-center transition-all">
        <span className="font-mono text-[10px] text-black/40 uppercase tracking-widest block mb-1">
          WRISTBAND NUMBER
        </span>
        <div className="font-display text-4xl font-bold text-black tracking-wider">
          {digits ? `#${digits}` : <span className="text-black/20">#_ _</span>}
        </div>

        {matchedGuest ? (
          <div className="mt-2 pt-2 border-t border-black/10 flex items-center justify-between gap-2 text-xs font-sans-clean">
            <button
              type="button"
              onClick={() => {
                if (onSelectGuest) {
                  onSelectGuest(matchedGuest);
                  setDigits('');
                }
              }}
              className="flex items-center gap-1.5 font-bold text-black hover:underline truncate max-w-[180px] cursor-pointer text-left"
              title="Click to load guest profile on station"
            >
              <User className="w-3.5 h-3.5 text-black/60 shrink-0" />
              <span className="truncate">{matchedGuest.name || matchedGuest.tag_id}</span>
            </button>
            <div
              className={`font-mono font-bold shrink-0 ${
                isLimitReached ? 'text-red-600' : 'text-black/70'
              }`}
            >
              {matchedGuest.drinks_consumed}/
              {matchedGuest.category === 'vip' ? '∞' : effectiveLimit}
            </div>
          </div>
        ) : digits ? (
          <span className="font-sans-clean text-[11px] text-black/40 mt-1 block lowercase">
            ready to assign/serve
          </span>
        ) : (
          <span className="font-sans-clean text-[11px] text-black/40 mt-1 block lowercase">
            tap or type wristband #
          </span>
        )}
      </div>

      {/* Action Button Row */}
      <div className="flex gap-2">
        {matchedGuest && onSelectGuest && (
          <button
            type="button"
            onClick={() => {
              onSelectGuest(matchedGuest);
              setDigits('');
            }}
            className="py-3.5 px-3.5 rounded-2xl bg-black/[0.06] hover:bg-black/12 text-black font-sans-clean font-bold text-xs lowercase transition-all shrink-0 cursor-pointer"
            title="Select guest without serving"
          >
            view
          </button>
        )}

        <button
          type="button"
          onClick={handleExecuteServe}
          disabled={!digits}
          className={`flex-1 py-4 rounded-2xl font-sans-clean font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
            isLimitReached
              ? 'bg-red-600 text-white hover:bg-red-700'
              : digits
              ? 'bg-black text-white hover:bg-black/90 active:scale-[0.98]'
              : 'bg-black/10 text-black/30 cursor-not-allowed shadow-none'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {isLimitReached
              ? 'Check Guest (Limit Reached)'
              : `Log ${selectedDrinkType} for #${digits || '...'}`}
          </span>
        </button>
      </div>

      {/* Tactile Numeric Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(num)}
            className="py-3.5 lg:py-3 rounded-2xl bg-white hover:bg-black/5 active:bg-black/10 text-black font-display text-2xl font-bold border border-black/10 shadow-sm transition-all select-none active:scale-95 cursor-pointer"
          >
            {num}
          </button>
        ))}

        <button
          type="button"
          onClick={handleClear}
          className="py-3.5 lg:py-3 rounded-2xl bg-black/5 hover:bg-black/10 text-black/60 font-sans-clean text-xs font-bold border border-black/5 transition-all select-none uppercase active:scale-95 cursor-pointer"
        >
          C
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="py-3.5 lg:py-3 rounded-2xl bg-white hover:bg-black/5 active:bg-black/10 text-black font-display text-2xl font-bold border border-black/10 shadow-sm transition-all select-none active:scale-95 cursor-pointer"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Backspace"
          className="py-3.5 lg:py-3 rounded-2xl bg-black/5 hover:bg-black/10 text-black/60 flex items-center justify-center border border-black/5 transition-all select-none active:scale-95 cursor-pointer"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
