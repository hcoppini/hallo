'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { GuestCategory } from '@/lib/types';
import {
  GlassWater,
  CheckCircle2,
  AlertOctagon,
  ArrowLeft,
  Beer,
  Sparkles,
  CupSoda,
  UserCheck,
  DoorOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundSystem } from '@/lib/audio';

export default function DirectTapPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || '';
  const tagId = decodeURIComponent(rawId).trim().toUpperCase();

  const { guests, settings, serveDrink, checkIn } = usePartyStore();

  const [servedSuccess, setServedSuccess] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Quick Registration Form State (if tag is new)
  const [guestName, setGuestName] = useState('');
  const [category, setCategory] = useState<GuestCategory>('standard');
  const [justActivated, setJustActivated] = useState(false);

  // Flexible tag matching
  const cleanKey = tagId.replace(/[:\-_%]/g, '');
  const guest = guests.find(
    g =>
      g.tag_id.toUpperCase() === tagId ||
      g.id.toUpperCase() === tagId ||
      g.tag_id.replace(/[:\-_%]/g, '').toUpperCase() === cleanKey
  );

  const isAssigned = Boolean(guest && guest.is_entered && guest.name);

  const effectiveLimit = guest
    ? calculateEffectiveLimit(guest, settings)
    : settings.default_drink_limit;

  const isLimitReached = Boolean(
    guest && guest.category !== 'vip' && guest.drinks_consumed >= effectiveLimit
  );

  const handleServe = async (type: 'cocktail' | 'beer' | 'soft') => {
    if (!guest) return;
    setIsProcessing(true);
    const res = await serveDrink(guest.tag_id, type);
    setIsProcessing(false);

    if (res.success) {
      setServedSuccess(true);
    } else {
      setErrorMsg(res.message || 'Drink limit reached or error');
    }
  };

  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    try {
      setIsProcessing(true);
      await checkIn({
        tag_id: tagId,
        name: guestName.trim(),
        category,
      });
      setIsProcessing(false);
      setJustActivated(true);
      soundSystem.playApprovedSound();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err) {
      setIsProcessing(false);
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <div className="w-full py-6 flex flex-col justify-center max-w-sm mx-auto">
      {/* CASE 1: Brand New or Unassigned Wristband -> Instant Registration */}
      {!isAssigned && !justActivated ? (
        <div className="glass-card p-6 sm:p-8 text-center border border-black/15 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center mx-auto mb-3 border border-black/10">
            <Sparkles className="w-6 h-6 text-black" />
          </div>
          <span className="font-mono text-[10px] text-black/50 block tracking-widest uppercase mb-1">
            WRISTBAND DETECTED
          </span>
          <h2 className="font-display text-3xl font-bold lowercase text-black mb-1">
            assign guest
          </h2>
          <div className="inline-block px-2.5 py-1 rounded-full bg-black/5 font-mono text-xs font-bold text-black mb-5 truncate max-w-[240px]">
            {tagId}
          </div>

          <form onSubmit={handleQuickRegister} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1">
                guest name
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Kasia"
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                className="w-full px-4 py-3 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-sm text-black outline-none focus:border-black transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1">
                guest category
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'standard', label: '18+' },
                  { id: 'driver_minor', label: '0 alc' },
                  { id: 'vip', label: 'vip' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id as GuestCategory)}
                    className={`py-2 rounded-xl text-xs font-sans-clean font-bold transition-all border ${
                      category === cat.id
                        ? 'bg-black text-white border-black shadow-sm'
                        : 'bg-white text-black/70 border-black/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="btn-premium-primary w-full py-4 text-xs gap-2 mt-2"
            >
              <UserCheck className="w-4 h-4" />
              <span>activate wristband</span>
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-black/10 text-center">
            <button
              type="button"
              onClick={() => router.push(`/door?tag=${encodeURIComponent(tagId)}`)}
              className="font-sans-clean text-[11px] text-black/50 hover:text-black lowercase flex items-center justify-center gap-1 mx-auto"
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>or open full door check-in</span>
            </button>
          </div>
        </div>
      ) : isLimitReached ? (
        /* CASE 2: Limit Reached Screen */
        <div className="rounded-3xl bg-red-600 text-white p-8 shadow-2xl text-center border-4 border-white/20 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <AlertOctagon className="w-10 h-10 text-white" />
          </div>
          <span className="px-3.5 py-1 rounded-full bg-white text-red-700 font-sans-clean text-xs font-black tracking-widest uppercase inline-block mb-3">
            LIMIT REACHED
          </span>
          <h2 className="font-display text-4xl font-bold text-white lowercase mb-1">
            {guest?.name || guestName || 'Guest'}
          </h2>
          <p className="font-sans-clean text-sm text-white/90 mb-6">
            Maximum drink limit ({effectiveLimit}/{effectiveLimit}) reached.
            <br />No more alcohol can be served.
          </p>

          <button
            type="button"
            onClick={() => handleServe('soft')}
            disabled={isProcessing}
            className="w-full py-3.5 px-6 rounded-full bg-white text-black font-sans-clean text-xs font-bold tracking-wider uppercase hover:bg-neutral-100 transition-all flex items-center justify-center gap-2"
          >
            <CupSoda className="w-4 h-4" />
            <span>serve soft drink / water</span>
          </button>
        </div>
      ) : (
        /* CASE 3: Active Assigned Guest -> Drink Serving Screen */
        <div className="glass-card p-6 sm:p-8 border border-black/15 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-xs text-black/50 truncate max-w-[160px]">
              {guest?.tag_id || tagId}
            </span>
            {guest?.category === 'vip' ? (
              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                VIP
              </span>
            ) : guest?.category === 'driver_minor' ? (
              <span className="bg-blue-100 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                DRIVER / 0 ALC
              </span>
            ) : (
              <span className="bg-black/5 text-black/60 text-[10px] font-semibold px-2 py-0.5 rounded-full lowercase">
                standard
              </span>
            )}
          </div>

          <div className="text-center mb-6">
            <h2 className="font-display text-4xl font-bold lowercase text-black mb-1">
              {guest?.name || guestName || 'Party Guest'}
            </h2>
            <div className="font-display text-6xl font-bold text-black my-2">
              {guest?.drinks_consumed ?? 0}
              <span className="text-3xl text-black/30 font-normal">
                /{guest?.category === 'vip' ? '∞' : effectiveLimit}
              </span>
            </div>
            <span className="font-sans-clean text-xs font-semibold text-black/60 lowercase block">
              {guest?.category === 'vip'
                ? 'unlimited drinks'
                : `${Math.max(0, effectiveLimit - (guest?.drinks_consumed ?? 0))} drinks remaining`}
            </span>
          </div>

          {servedSuccess ? (
            <div className="p-4 mb-6 rounded-2xl bg-emerald-50 text-emerald-800 text-center border border-emerald-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
              <span className="font-display text-xl font-bold lowercase block">drink served!</span>
              <span className="font-sans-clean text-xs text-emerald-700">
                counter has been incremented.
              </span>
            </div>
          ) : (
            <div className="space-y-2 mb-6">
              <button
                type="button"
                onClick={() => handleServe('cocktail')}
                disabled={isProcessing}
                className="btn-premium-primary w-full py-3.5 text-xs gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>log cocktail (+1)</span>
              </button>

              <button
                type="button"
                onClick={() => handleServe('beer')}
                disabled={isProcessing}
                className="btn-premium w-full py-3 text-xs gap-2"
              >
                <Beer className="w-4 h-4" />
                <span>log beer (+1)</span>
              </button>

              <button
                type="button"
                onClick={() => handleServe('soft')}
                disabled={isProcessing}
                className="btn-premium w-full py-3 text-xs gap-2"
              >
                <CupSoda className="w-4 h-4" />
                <span>log soft drink (water/cola)</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push('/barman')}
            className="text-center w-full font-sans-clean text-xs text-black/50 hover:text-black lowercase flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>open barman station</span>
          </button>
        </div>
      )}
    </div>
  );
}
