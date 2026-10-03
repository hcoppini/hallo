'use client';

import React, { useState, useEffect } from 'react';
import {
  GlassWater,
  Beer,
  Wine,
  Sparkles,
  RotateCcw,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Search,
  CupSoda,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Guest, DrinkType, ServeDrinkResult } from '@/lib/types';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { getGuestDisplayName } from '@/lib/tag-utils';
import { AdminPinModal } from './AdminPinModal';

interface BarmanDisplayProps {
  lastResult: ServeDrinkResult | null;
  selectedDrinkType: DrinkType;
  onDrinkTypeChange: (type: DrinkType) => void;
  onManualServe: (guestId: string, type: DrinkType) => void;
  onOpenSearch: () => void;
}

export function BarmanDisplay({
  lastResult,
  selectedDrinkType,
  onDrinkTypeChange,
  onManualServe,
  onOpenSearch,
}: BarmanDisplayProps) {
  const { guests, settings, revertLastDrink, updateGuest } = usePartyStore();
  const [undoCountdown, setUndoCountdown] = useState<number>(0);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [overrideGuest, setOverrideGuest] = useState<Guest | null>(null);

  // Sync with current guest state in store
  const activeGuest = lastResult?.guest
    ? guests.find(g => g.id === lastResult.guest?.id) || lastResult.guest
    : null;

  const effectiveLimit = activeGuest
    ? calculateEffectiveLimit(activeGuest, settings)
    : settings.default_drink_limit;

  const isLimitReached = Boolean(
    activeGuest &&
    activeGuest.category !== 'vip' &&
    activeGuest.drinks_consumed >= effectiveLimit
  );

  const isFinalDrink = Boolean(
    activeGuest &&
    activeGuest.category !== 'vip' &&
    activeGuest.drinks_consumed === effectiveLimit
  );

  // Undo 10-second timer
  useEffect(() => {
    if (lastResult?.success && lastResult.drink_type !== 'soft') {
      setUndoCountdown(10);
      const timer = setInterval(() => {
        setUndoCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lastResult]);

  // Confetti on first drink / party excitement
  useEffect(() => {
    if (lastResult?.success && lastResult.drinks_consumed === 1) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#000000', '#D4AF37', '#FF6B00'],
      });
    }
  }, [lastResult]);

  const handleUndo = async () => {
    if (activeGuest) {
      await revertLastDrink(activeGuest.id);
      setUndoCountdown(0);
    }
  };

  const handleSupervisorOverride = async () => {
    if (activeGuest) {
      const newCustomLimit = (activeGuest.custom_drink_limit ?? settings.default_drink_limit) + 1;
      await updateGuest({
        id: activeGuest.id,
        custom_drink_limit: newCustomLimit,
        notes: `Overridden by supervisor at ${new Date().toLocaleTimeString()}`,
      });
      setIsPinModalOpen(false);
    }
  };

  const drinkTypeOptions: { type: DrinkType; label: string; icon: React.ElementType }[] = [
    { type: 'cocktail', label: 'cocktail', icon: Sparkles },
    { type: 'beer', label: 'beer', icon: Beer },
    { type: 'shot', label: 'shot', icon: GlassWater },
    { type: 'wine', label: 'wine', icon: Wine },
    { type: 'soft', label: 'soft drink', icon: CupSoda },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Drink Type Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-black/5 rounded-2xl border border-black/10">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {drinkTypeOptions.map(({ type, label, icon: Icon }) => {
            const isSelected = selectedDrinkType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onDrinkTypeChange(type)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-sans-clean text-xs font-semibold tracking-wider lowercase transition-all ${
                  isSelected
                    ? 'bg-black text-white shadow-md'
                    : 'bg-white/60 hover:bg-white text-black/70 hover:text-black border border-black/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenSearch}
          className="btn-premium gap-1.5 py-2 px-3 text-xs"
        >
          <Search className="w-3.5 h-3.5" />
          <span>search guest</span>
        </button>
      </div>

      {/* Main Status Display Screen */}
      {!lastResult && !activeGuest ? (
        <div className="glass-card p-12 text-center border-dashed border-2 border-black/15">
          <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mx-auto mb-4">
            <GlassWater className="w-8 h-8 text-black/40" />
          </div>
          <h2 className="font-display text-3xl font-bold lowercase text-black mb-2">
            barman station standing by
          </h2>
          <p className="font-sans-clean text-xs text-black/60 lowercase max-w-sm mx-auto">
            guest taps wristband to order a drink. screen will immediately update with limits and safety alerts.
          </p>
        </div>
      ) : isLimitReached ? (
        /* CUT OFF / LIMIT REACHED SCREEN */
        <div className="rounded-3xl bg-red-600 text-white p-8 sm:p-10 shadow-2xl animate-pulse border-4 border-white/20">
          <div className="flex items-center justify-between mb-4">
            <span className="px-3.5 py-1 rounded-full bg-white text-red-700 font-sans-clean text-xs font-black tracking-widest uppercase">
              DO NOT SERVE ALCOHOL
            </span>
            <span className="font-mono text-xs text-white/80">
              TAG: {activeGuest?.tag_id}
            </span>
          </div>

          <div className="flex items-start gap-4 mb-6">
            <AlertOctagon className="w-14 h-14 sm:w-16 sm:h-16 text-white shrink-0 mt-1" />
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white lowercase">
                limit reached
              </h2>
              <p className="text-white/90 text-lg font-sans-clean font-semibold">
                {activeGuest ? getGuestDisplayName(activeGuest) : 'Guest'} has had {activeGuest?.drinks_consumed} of {effectiveLimit} drinks.
              </p>
            </div>
          </div>

          <div className="bg-black/25 rounded-2xl p-4 mb-6 text-sm text-white/90 font-sans-clean">
            Only non-alcoholic beverages (water, cola, mocktail) are permitted for this guest.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onManualServe(activeGuest!.tag_id, 'soft')}
              className="flex-1 py-3.5 px-6 rounded-full bg-white text-black font-sans-clean text-xs font-bold tracking-wider uppercase hover:bg-neutral-100 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <CupSoda className="w-4 h-4" />
              <span>serve soft drink (water/cola)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOverrideGuest(activeGuest);
                setIsPinModalOpen(true);
              }}
              className="py-3.5 px-6 rounded-full bg-black/40 text-white hover:bg-black/60 border border-white/30 font-sans-clean text-xs font-bold tracking-wider uppercase transition-all flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>supervisor override (+1)</span>
            </button>
          </div>
        </div>
      ) : (
        /* APPROVED DRINK SCREEN */
        <div className={`glass-card p-8 sm:p-10 relative overflow-hidden ${
          isFinalDrink ? 'border-amber-400 bg-amber-50/20' : 'border-black/15'
        }`}>
          {/* Top Status Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                isFinalDrink ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
              }`} />
              <span className="font-sans-clean text-xs font-bold tracking-widest uppercase text-black">
                {isFinalDrink ? 'FINAL DRINK OF THE NIGHT' : 'DRINK SERVED'}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-black/50">
              <span>TAG: {activeGuest?.tag_id}</span>
              {activeGuest?.category === 'vip' && (
                <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-bold">
                  VIP
                </span>
              )}
            </div>
          </div>

          {/* Guest Name & Big Counter */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-4xl sm:text-5xl font-bold lowercase text-black mb-1">
                {activeGuest ? getGuestDisplayName(activeGuest) : 'Guest'}
              </h2>
              <span className="font-sans-clean text-xs text-black/50 lowercase">
                entered {activeGuest?.entered_at ? new Date(activeGuest.entered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
              </span>
            </div>

            <div className="text-right">
              <div className="font-display text-6xl sm:text-7xl font-bold tracking-tight text-black leading-none">
                {activeGuest?.drinks_consumed}
                <span className="text-3xl sm:text-4xl text-black/30 font-normal">
                  /{activeGuest?.category === 'vip' ? '∞' : effectiveLimit}
                </span>
              </div>
              <span className="font-sans-clean text-xs font-semibold tracking-wider text-black/60 uppercase block mt-1">
                {activeGuest?.category === 'vip'
                  ? 'unlimited drinks'
                  : `${Math.max(0, effectiveLimit - (activeGuest?.drinks_consumed || 0))} drinks remaining`}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          {activeGuest?.category !== 'vip' && (
            <div className="w-full bg-black/10 rounded-full h-3 mb-8 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isFinalDrink
                    ? 'bg-amber-500'
                    : 'bg-black'
                }`}
                style={{
                  width: `${Math.min(100, ((activeGuest?.drinks_consumed || 0) / effectiveLimit) * 100)}%`,
                }}
              />
            </div>
          )}

          {/* Actions & Undo Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-black/10">
            {undoCountdown > 0 ? (
              <button
                type="button"
                onClick={handleUndo}
                className="btn-premium gap-2 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>undo accidental tap ({undoCountdown}s)</span>
              </button>
            ) : (
              <div className="text-[11px] font-sans-clean text-black/40 lowercase">
                served: {lastResult?.drink_type || 'drink'}
              </div>
            )}

            <button
              type="button"
              onClick={() => onManualServe(activeGuest!.tag_id, selectedDrinkType)}
              className="btn-premium-primary gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>serve another {selectedDrinkType}</span>
            </button>
          </div>
        </div>
      )}

      {/* Supervisor PIN Modal */}
      <AdminPinModal
        isOpen={isPinModalOpen}
        title="supervisor drink override"
        subtitle={`enter admin pin to increase drink limit for ${activeGuest?.name || 'this guest'}`}
        onSuccess={handleSupervisorOverride}
        onClose={() => setIsPinModalOpen(false)}
      />
    </div>
  );
}
