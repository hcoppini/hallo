'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Lock, X, ShieldAlert, Keyboard } from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { soundSystem } from '@/lib/audio';
import { setStaffAuthenticated } from '@/lib/auth';

interface AdminPinModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function AdminPinModal({
  isOpen,
  title = 'security authorization',
  subtitle = 'enter 4-digit parent/admin pin to continue',
  onSuccess,
  onClose,
}: AdminPinModalProps) {
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
        onSuccess();
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

  // Physical keyboard support for laptop / desktop users
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigit, handleBackspace, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bottom-sheet max-w-sm sm:max-w-md w-full p-6 sm:p-8 relative bg-white border-t sm:border border-black/15 shadow-2xl rounded-t-[32px] sm:rounded-3xl pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:pb-8">
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-4 sm:hidden" />

        <button
          onClick={onClose}
          type="button"
          title="Close (Esc)"
          className="absolute top-5 right-5 p-2 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mx-auto mb-4 border border-black/10">
            <Lock className="w-5 h-5 text-black" />
          </div>
          <h3 className="font-display text-2xl font-bold lowercase text-black mb-1">
            {title}
          </h3>
          <p className="font-sans-clean text-xs text-black/60 lowercase">
            {subtitle}
          </p>
          <div className="hidden sm:inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-black/[0.04] text-[10px] font-mono text-black/50">
            <Keyboard className="w-3 h-3 text-black/40" />
            <span>physical numpad active (type digits or press esc)</span>
          </div>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map(idx => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
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
          <div className="flex items-center justify-center gap-1.5 text-xs text-red-600 font-sans-clean mb-4 animate-shake">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>incorrect pin. try again.</span>
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="h-14 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-95 font-display text-xl font-bold text-black transition-all flex items-center justify-center border border-black/5 cursor-pointer"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="h-14 rounded-2xl bg-transparent font-sans-clean text-xs tracking-wider uppercase text-black/50 hover:text-black transition-all flex items-center justify-center cursor-pointer"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-95 font-display text-xl font-bold text-black transition-all flex items-center justify-center border border-black/5 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-95 font-sans-clean text-xs tracking-wider uppercase text-black transition-all flex items-center justify-center border border-black/5 cursor-pointer"
          >
            del
          </button>
        </div>

        <div className="mt-6 text-center">
          <span className="text-[10px] text-black/40 font-sans-clean lowercase">
            authorized organizers and staff only
          </span>
        </div>
      </div>
    </div>
  );
}
