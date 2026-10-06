'use client';

import React, { useState, useMemo } from 'react';
import { Delete, Sparkles, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { DrinkType, Guest } from '@/lib/types';
import { parseTagId, findGuestByTag } from '@/lib/tag-utils';
import { calculateEffectiveLimit } from '@/lib/party-engine';

interface SpeedKeypadProps {
  onServe: (tagId: string, drinkType: DrinkType) => void;
  selectedDrinkType: DrinkType;
}

export function SpeedKeypad({ onServe, selectedDrinkType }: SpeedKeypadProps) {
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

  const handleDigit = (d: string) => {
    if (digits.length >= 3) return;
    setDigits(prev => prev + d);
  };

  const handleBackspace = () => {
    setDigits(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setDigits('');
  };

  const handleExecuteServe = () => {
    if (!digits) return;
    const num = parseInt(digits, 10);
    const tagToServe = matchedGuest ? matchedGuest.tag_id : `TAG-${num.toString().padStart(3, '0')}`;
    onServe(tagToServe, selectedDrinkType);
    setDigits('');
  };

  return (
    <div className="glass-card p-5 sm:p-6 border border-black/15 shadow-xl max-w-sm mx-auto space-y-4">
      {/* Target Wristband & Match Preview Screen */}
      <div className="p-4 rounded-2xl bg-black/[0.04] border border-black/10 text-center min-h-[96px] flex flex-col justify-center transition-all">
        <span className="font-mono text-[10px] text-black/40 uppercase tracking-widest block mb-1">
          WRISTBAND NUMBER
        </span>
        <div className="font-display text-4xl font-bold text-black tracking-wider">
          {digits ? `#${digits}` : <span className="text-black/20">#_ _</span>}
        </div>

        {matchedGuest ? (
          <div className="mt-2 pt-2 border-t border-black/10 flex items-center justify-between text-xs font-sans-clean">
            <div className="flex items-center gap-1.5 font-bold text-black truncate max-w-[170px]">
              <User className="w-3.5 h-3.5 text-black/60 shrink-0" />
              <span className="truncate">{matchedGuest.name || matchedGuest.tag_id}</span>
            </div>
            <div className={`font-mono font-bold ${isLimitReached ? 'text-red-600' : 'text-black/70'}`}>
              {matchedGuest.drinks_consumed}/{matchedGuest.category === 'vip' ? '∞' : effectiveLimit}
            </div>
          </div>
        ) : digits ? (
          <span className="font-sans-clean text-[11px] text-black/40 mt-1 block lowercase">
            ready to assign/serve
          </span>
        ) : (
          <span className="font-sans-clean text-[11px] text-black/40 mt-1 block lowercase">
            tap guest wristband #
          </span>
        )}
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleExecuteServe}
        disabled={!digits}
        className={`w-full py-4 rounded-2xl font-sans-clean font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-md ${
          isLimitReached
            ? 'bg-red-600 text-white hover:bg-red-700'
            : digits
            ? 'bg-black text-white hover:bg-black/90 active:scale-[0.98]'
            : 'bg-black/10 text-black/30 cursor-not-allowed shadow-none'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        <span>
          {isLimitReached
            ? 'Check Guest (Limit Reached)'
            : `Log ${selectedDrinkType} for #${digits || '...'}`}
        </span>
      </button>

      {/* Tactile Numeric Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(num)}
            className="py-4 rounded-2xl bg-white hover:bg-black/5 active:bg-black/10 text-black font-display text-2xl font-bold border border-black/10 shadow-sm transition-all select-none active:scale-95"
          >
            {num}
          </button>
        ))}

        <button
          type="button"
          onClick={handleClear}
          className="py-4 rounded-2xl bg-black/5 hover:bg-black/10 text-black/60 font-sans-clean text-xs font-bold border border-black/5 transition-all select-none uppercase active:scale-95"
        >
          C
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="py-4 rounded-2xl bg-white hover:bg-black/5 active:bg-black/10 text-black font-display text-2xl font-bold border border-black/10 shadow-sm transition-all select-none active:scale-95"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Backspace"
          className="py-4 rounded-2xl bg-black/5 hover:bg-black/10 text-black/60 flex items-center justify-center border border-black/5 transition-all select-none active:scale-95"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
