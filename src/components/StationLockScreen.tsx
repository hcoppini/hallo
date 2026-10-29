'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Lock, ShieldAlert, Keyboard, ShieldCheck } from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { soundSystem } from '@/lib/audio';
import { setStaffAuthenticated } from '@/lib/auth';

interface StationLockScreenProps {
  stationTitle: string;
  stationSubtitle: string;
  stationBadge?: string;
  onSuccess?: () => void;
}

export function StationLockScreen({
  stationTitle,
  stationSubtitle,
  stationBadge = 'STAFF TERMINAL LOCK',
  onSuccess,
}: StationLockScreenProps) {
  const { settings } = usePartyStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const verify = useCallback(
    (inputPin: string) => {
      if (inputPin === settings.admin_pin) {
        soundSystem.playApprovedSound();
        setPin('');
        setError(false);
        setStaffAuthenticated(true);
        onSuccess?.();
      } else {
        soundSystem.playErrorSound();
        setError(true);
        setTimeout(() => {
          setPin('');
        }, 600);
      }
    },
    [settings.admin_pin, onSuccess]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      setPin(prev => {
        if (prev.length >= 4) return prev;
        const nextPin = prev + digit;
        setError(false);
        if (nextPin.length === 4) {
          verify(nextPin);
        }
        return nextPin;
      });
    },
    [verify]
  );

  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  }, []);

  // Immediate physical keyboard typing on laptop / desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleBackspace]);

  return (
    <div className="w-full py-10 sm:py-16 lg:py-20 flex flex-col items-center justify-center max-w-md lg:max-w-xl mx-auto px-4 animate-in fade-in duration-200">
      <div className="glass-card p-8 sm:p-10 lg:p-12 border border-black/15 shadow-2xl rounded-3xl w-full text-center relative overflow-hidden">
        {/* Subtle Top Accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-black/10" />

        <div className="w-16 h-16 rounded-3xl bg-black/5 flex items-center justify-center mx-auto mb-5 text-black border border-black/10 shadow-xs">
          <Lock className="w-8 h-8" />
        </div>

        <span className="font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-black/[0.04] text-black/60 border border-black/8 inline-block mb-2">
          {stationBadge}
        </span>

        <h2 className="font-display text-3xl sm:text-4xl font-bold lowercase text-black mb-1">
          {stationTitle}
        </h2>
        <p className="font-sans-clean text-xs sm:text-sm text-black/60 max-w-sm mx-auto mb-6">
          {stationSubtitle}
        </p>

        {/* Desktop Keyboard Notice */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/[0.04] text-[11px] font-mono text-black/60 border border-black/8">
            <Keyboard className="w-3.5 h-3.5 text-black/45" />
            <span>enter staff pin ({settings.admin_pin || '2113'}) or click quick unlock</span>
          </div>
          <button
            type="button"
            onClick={() => verify(settings.admin_pin || '2113')}
            className="text-[11px] font-mono font-medium text-black/50 hover:text-black underline cursor-pointer transition-colors"
          >
            ⚡ quick unlock station ({settings.admin_pin || '2113'})
          </button>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map(idx => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  error
                    ? 'bg-red-500 scale-110'
                    : isFilled
                    ? 'bg-black scale-100'
                    : 'bg-black/15'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-red-600 font-sans-clean mb-5 animate-shake">
            <ShieldAlert className="w-4 h-4" />
            <span>incorrect pin. try again.</span>
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="h-14 sm:h-16 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-95 font-display text-xl sm:text-2xl font-bold text-black transition-all flex items-center justify-center border border-black/5 cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            className="h-14 sm:h-16 rounded-2xl bg-transparent font-sans-clean text-xs tracking-wider uppercase text-black/40 hover:text-black transition-all flex items-center justify-center cursor-pointer"
          >
            clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 sm:h-16 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-95 font-display text-xl sm:text-2xl font-bold text-black transition-all flex items-center justify-center border border-black/5 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 sm:h-16 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-95 font-sans-clean text-xs tracking-wider uppercase text-black transition-all flex items-center justify-center border border-black/5 cursor-pointer"
          >
            del
          </button>
        </div>

        <div className="mt-8 pt-5 border-t border-black/8 flex items-center justify-center gap-2 text-black/40 text-[11px] font-sans-clean">
          <ShieldCheck className="w-3.5 h-3.5 text-black/35" />
          <span>authorized hosts, bartenders and supervisors only</span>
        </div>
      </div>
    </div>
  );
}
