'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { Guest, GuestCategory } from '@/lib/types';
import { parseTagId, findGuestByTag } from '@/lib/tag-utils';
import {
  Sparkles,
  UserCheck,
  Lock,
  Shield,
  AlertOctagon,
  CupSoda,
  Beer,
  CheckCircle2,
  Loader2,
  DoorOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundSystem } from '@/lib/audio';

export default function DirectTapPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || '';
  const parsedTag = parseTagId(rawId);
  const tagId = parsedTag.canonicalTag || parsedTag.decoded.toUpperCase();

  const { guests, settings, serveDrink, checkIn, fetchGuestByTag } = usePartyStore();

  const [isLoading, setIsLoading] = useState(true);
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [servedSuccess, setServedSuccess] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Quick Registration Form State (only shown if wristband is unassigned)
  const [guestName, setGuestName] = useState('');
  const [category, setCategory] = useState<GuestCategory>('standard');

  // 1. Initial lookup on mount: query Supabase & store directly
  useEffect(() => {
    let isMounted = true;

    async function loadWristband() {
      setIsLoading(true);
      setErrorMsg(null);

      // Fast check in memory first
      const memGuest = findGuestByTag(guests, tagId);
      if (memGuest && memGuest.name && memGuest.is_entered) {
        if (isMounted) {
          setActiveGuest(memGuest);
          setIsLoading(false);
        }
        return;
      }

      // Direct Supabase lookup for authoritative cloud state
      try {
        const cloudGuest = await fetchGuestByTag(tagId);
        if (isMounted) {
          setActiveGuest(cloudGuest);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setActiveGuest(memGuest || null);
          setIsLoading(false);
        }
      }
    }

    if (tagId) {
      loadWristband();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [tagId, fetchGuestByTag]);

  // 2. Keep activeGuest synced if global store updates (e.g. drinks served or realtime)
  useEffect(() => {
    const updated = findGuestByTag(guests, tagId);
    if (updated) {
      setActiveGuest(updated);
    }
  }, [guests, tagId]);

  // Is this wristband assigned to a person?
  const isAssigned = Boolean(
    activeGuest &&
    activeGuest.is_entered &&
    activeGuest.name &&
    activeGuest.name.trim().length > 0
  );

  const assignedGuest = isAssigned && activeGuest ? activeGuest : null;

  const effectiveLimit = assignedGuest
    ? calculateEffectiveLimit(assignedGuest, settings)
    : settings.default_drink_limit;

  const isLimitReached = Boolean(
    assignedGuest &&
    assignedGuest.category !== 'vip' &&
    assignedGuest.drinks_consumed >= effectiveLimit
  );

  // Serve drink handler
  const handleServe = async (type: 'cocktail' | 'beer' | 'soft') => {
    if (!assignedGuest) return;
    setIsProcessing(true);
    setErrorMsg(null);
    const res = await serveDrink(assignedGuest.tag_id, type);
    setIsProcessing(false);

    if (res.success) {
      setServedSuccess(true);
      setTimeout(() => setServedSuccess(null), 3500);
    } else {
      setErrorMsg(res.message || 'Drink limit reached or error');
    }
  };

  // First-tap wristband assignment
  const handleFirstTapAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    try {
      setIsProcessing(true);
      setErrorMsg(null);

      const checkedInGuest = await checkIn({
        tag_id: tagId,
        name: guestName.trim(),
        category,
      });

      setActiveGuest(checkedInGuest);
      setIsProcessing(false);
      soundSystem.playApprovedSound();

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err) {
      setIsProcessing(false);
      setErrorMsg(err instanceof Error ? err.message : 'Registration failed. Try again.');
    }
  };

  return (
    <div className="w-full py-6 flex flex-col justify-center max-w-sm mx-auto">
      {/* CASE 0: Loading State (protects against flash of registration form) */}
      {isLoading ? (
        <div className="glass-card p-10 text-center border border-black/15 shadow-xl animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center mx-auto mb-4 border border-black/10">
            <Loader2 className="w-6 h-6 text-black animate-spin" />
          </div>
          <span className="font-mono text-[10px] text-black/50 block tracking-widest uppercase mb-1">
            CHECKING WRISTBAND
          </span>
          <h2 className="font-display text-2xl font-bold lowercase text-black mb-2">
            {tagId}
          </h2>
          <p className="font-sans-clean text-xs text-black/50 lowercase">
            verifying pass status in database...
          </p>
        </div>
      ) : !assignedGuest ? (
        /* CASE 1: Brand New / First Tap Wristband -> Single-Use Registration Form */
        <div className="glass-card p-6 sm:p-8 text-center border border-black/15 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center mx-auto mb-3 border border-black/10">
            <Sparkles className="w-6 h-6 text-black" />
          </div>
          <span className="font-mono text-[10px] text-black/50 block tracking-widest uppercase mb-1">
            FIRST TAP DETECTED
          </span>
          <h2 className="font-display text-3xl font-bold lowercase text-black mb-1">
            assign guest
          </h2>
          <div className="inline-block px-3 py-1 rounded-full bg-black/5 font-mono text-xs font-bold text-black mb-5 truncate max-w-[240px]">
            {tagId}
          </div>

          {errorMsg && (
            <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-sans-clean text-left">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleFirstTapAssign} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1">
                guest name
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Kasia Kowalska"
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
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
              <span>{isProcessing ? 'activating...' : 'activate wristband'}</span>
            </button>
          </form>

          <p className="mt-4 text-[11px] font-sans-clean text-black/40 lowercase">
            once activated, this wristband is permanently locked to this guest.
          </p>

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
            {assignedGuest.name}
          </h2>
          <p className="font-sans-clean text-sm text-white/90 mb-6">
            Maximum drink limit ({effectiveLimit}/{effectiveLimit}) reached.
            <br />No more alcohol can be served.
          </p>

          <button
            type="button"
            onClick={() => handleServe('soft')}
            disabled={isProcessing}
            className="w-full py-3.5 px-6 rounded-full bg-white text-black font-sans-clean text-xs font-bold tracking-wider uppercase hover:bg-neutral-100 transition-all flex items-center justify-center gap-2 mb-4"
          >
            <CupSoda className="w-4 h-4" />
            <span>serve soft drink / water</span>
          </button>

          {/* Locked Notice */}
          <div className="pt-4 border-t border-white/20 text-left flex items-start gap-2 text-white/80">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-sans-clean text-[11px] leading-tight">
              Wristband locked to {assignedGuest.name}. Limits can only be adjusted from the Admin Panel.
            </p>
          </div>
        </div>
      ) : (
        /* CASE 3: Active Assigned Guest -> Party Pass & Drink Serving Screen (LOCKED) */
        <div className="glass-card p-6 sm:p-8 border border-black/15 shadow-xl space-y-6">
          {/* Header Badges */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-black/50 truncate max-w-[150px]">
              {assignedGuest.tag_id}
            </span>
            {assignedGuest.category === 'vip' ? (
              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                VIP / UNLIMITED
              </span>
            ) : assignedGuest.category === 'driver_minor' ? (
              <span className="bg-blue-100 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                DRIVER / 0 ALC
              </span>
            ) : (
              <span className="bg-black/5 text-black/60 text-[10px] font-semibold px-2 py-0.5 rounded-full lowercase">
                standard (18+)
              </span>
            )}
          </div>

          {/* Guest Identity & Drink Counter */}
          <div className="text-center">
            <span className="font-mono text-[10px] text-black/40 uppercase tracking-widest block mb-1">
              PARTY PASS
            </span>
            <h2 className="font-display text-4xl font-bold lowercase text-black mb-1">
              {assignedGuest.name}
            </h2>
            <div className="font-display text-6xl font-bold text-black my-2">
              {assignedGuest.drinks_consumed}
              <span className="text-3xl text-black/30 font-normal">
                /{assignedGuest.category === 'vip' ? '∞' : effectiveLimit}
              </span>
            </div>
            <span className="font-sans-clean text-xs font-semibold text-black/60 lowercase block">
              {assignedGuest.category === 'vip'
                ? 'unlimited drinks'
                : `${Math.max(0, effectiveLimit - assignedGuest.drinks_consumed)} drinks remaining`}
            </span>
          </div>

          {/* Drink Served Success Toast */}
          {servedSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 text-center border border-emerald-200 animate-in fade-in duration-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
              <span className="font-display text-xl font-bold lowercase block">drink served!</span>
              <span className="font-sans-clean text-xs text-emerald-700">
                counter has been updated.
              </span>
            </div>
          )}

          {/* Drink Action Buttons */}
          <div className="space-y-2">
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

          {/* User Requirement: STRICT LOCKDOWN NOTICE */}
          <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/10 text-left">
            <div className="flex items-center gap-1.5 text-black font-sans-clean font-semibold text-xs mb-1">
              <Lock className="w-3.5 h-3.5 text-black/70" />
              <span>wristband locked to {assignedGuest.name}</span>
            </div>
            <p className="font-sans-clean text-[11px] text-black/60 leading-relaxed">
              This wristband has already been assigned and cannot be re-assigned from direct tap. Any edits must be done from the Admin Panel.
            </p>
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="mt-3 w-full py-2 px-3 rounded-xl bg-white border border-black/15 font-sans-clean text-xs font-semibold text-black/80 hover:text-black flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <Shield className="w-3.5 h-3.5 text-black/60" />
              <span>edit in admin panel (pin: 1031)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
