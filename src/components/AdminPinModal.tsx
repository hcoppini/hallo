'use client';

import React, { useState } from 'react';
import { Lock, X, Check, ShieldAlert } from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { soundSystem } from '@/lib/audio';

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

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === 4) {
        verify(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const verify = (inputPin: string) => {
    if (inputPin === settings.admin_pin) {
      soundSystem.playApprovedSound();
      setPin('');
      setError(false);
      onSuccess();
    } else {
      soundSystem.playErrorSound();
      setError(true);
      setTimeout(() => {
        setPin('');
      }, 600);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-card max-w-sm w-full p-8 relative border border-black/15 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-1.5 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors"
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
        <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="h-14 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-95 font-display text-xl font-bold text-black transition-all flex items-center justify-center border border-black/5"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="h-14 rounded-2xl bg-transparent font-sans-clean text-xs tracking-wider uppercase text-black/50 hover:text-black transition-all flex items-center justify-center"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-95 font-display text-xl font-bold text-black transition-all flex items-center justify-center border border-black/5"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-95 font-sans-clean text-xs tracking-wider uppercase text-black transition-all flex items-center justify-center border border-black/5"
          >
            del
          </button>
        </div>

        <div className="mt-6 text-center">
          <span className="text-[10px] text-black/40 font-sans-clean lowercase">
            default security pin: 1031 (changeable in admin)
          </span>
        </div>
      </div>
    </div>
  );
}
