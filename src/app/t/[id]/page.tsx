'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LuawsHeader } from '@/components/LuawsHeader';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { GlassWater, CheckCircle2, AlertOctagon, ArrowLeft, Beer, Sparkles, CupSoda } from 'lucide-react';
import { soundSystem } from '@/lib/audio';

export default function DirectTapPage() {
  const params = useParams();
  const router = useRouter();
  const tagId = (params?.id as string)?.toUpperCase() || '';
  const { guests, settings, serveDrink } = usePartyStore();

  const [servedSuccess, setServedSuccess] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const guest = guests.find(
    g => g.tag_id.toUpperCase() === tagId || g.id.toUpperCase() === tagId
  );

  const effectiveLimit = guest ? calculateEffectiveLimit(guest, settings) : settings.default_drink_limit;
  const isLimitReached = guest && guest.category !== 'vip' && guest.drinks_consumed >= effectiveLimit;
  const isFinalDrink = guest && guest.category !== 'vip' && guest.drinks_consumed === effectiveLimit - 1;

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

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <LuawsHeader />

      <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col justify-center">
        {!guest ? (
          <div className="glass-card p-8 text-center border border-black/10">
            <h2 className="font-display text-3xl font-bold lowercase text-black mb-2">
              tag not found
            </h2>
            <p className="font-sans-clean text-xs text-black/60 lowercase mb-6">
              wristband ID '{tagId}' is not registered in the system.
            </p>
            <button
              onClick={() => router.push('/door')}
              className="btn-premium-primary text-xs"
            >
              register at door
            </button>
          </div>
        ) : isLimitReached ? (
          /* Limit Reached Card */
          <div className="rounded-3xl bg-red-600 text-white p-8 shadow-2xl text-center border-4 border-white/20 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
              <AlertOctagon className="w-10 h-10 text-white" />
            </div>
            <span className="px-3.5 py-1 rounded-full bg-white text-red-700 font-sans-clean text-xs font-black tracking-widest uppercase inline-block mb-3">
              LIMIT REACHED
            </span>
            <h2 className="font-display text-4xl font-bold text-white lowercase mb-1">
              {guest.name || 'Guest'}
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
          /* Active Guest Card */
          <div className="glass-card p-8 border border-black/15 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-xs text-black/50">{guest.tag_id}</span>
              {guest.category === 'vip' ? (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  VIP
                </span>
              ) : guest.category === 'driver_minor' ? (
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
                {guest.name || 'Party Guest'}
              </h2>
              <div className="font-display text-6xl font-bold text-black my-2">
                {guest.drinks_consumed}
                <span className="text-3xl text-black/30 font-normal">
                  /{guest.category === 'vip' ? '∞' : effectiveLimit}
                </span>
              </div>
              <span className="font-sans-clean text-xs font-semibold text-black/60 lowercase block">
                {guest.category === 'vip'
                  ? 'unlimited drinks'
                  : `${Math.max(0, effectiveLimit - guest.drinks_consumed)} drinks remaining`}
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
              <span>back to barman station</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
