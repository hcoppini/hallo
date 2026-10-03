'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { Guest, GuestCategory } from '@/lib/types';
import { parseTagId, findGuestByTag, getGuestDisplayName } from '@/lib/tag-utils';
import { useStaffAuth } from '@/lib/auth';
import { AdminPinModal } from '@/components/AdminPinModal';
import {
  Sparkles,
  UserCheck,
  Lock,
  Shield,
  ShieldCheck,
  AlertOctagon,
  CupSoda,
  Beer,
  CheckCircle2,
  Loader2,
  DoorOpen,
  RotateCcw,
  GlassWater,
  LogOut,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundSystem } from '@/lib/audio';

export default function DirectTapPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || '';
  const parsedTag = parseTagId(rawId);
  const tagId = parsedTag.canonicalTag || parsedTag.decoded.toUpperCase();

  const { guests, settings, serveDrink, revertLastDrink, checkIn, fetchGuestByTag } = usePartyStore();
  const { isAuthenticated, logout } = useStaffAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [servedSuccess, setServedSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Quick Registration Form State (only for staff on unassigned wristbands)
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

      // Authoritative Supabase lookup
      try {
        const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 3000));
        const cloudGuest = await Promise.race([fetchGuestByTag(tagId), timeoutPromise]);
        if (isMounted) {
          setActiveGuest(cloudGuest || memGuest || null);
          setIsLoading(false);
        }
      } catch {
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
  }, [tagId, fetchGuestByTag, guests]);

  // 2. Keep activeGuest synced if global store updates
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

  // Staff Serve drink handler
  const handleServe = async (type: 'cocktail' | 'beer' | 'soft') => {
    if (!assignedGuest || !isAuthenticated) return;
    setIsProcessing(true);
    setErrorMsg(null);
    const res = await serveDrink(assignedGuest.tag_id, type);
    setIsProcessing(false);

    if (res.success) {
      const typeName = type === 'soft' ? 'soft drink' : type;
      setServedSuccess(`Logged ${typeName} (+1)`);
      setTimeout(() => setServedSuccess(null), 3000);
    } else {
      setErrorMsg(res.message || 'Drink limit reached or error');
    }
  };

  // Staff Undo last drink handler
  const handleUndo = async () => {
    if (!assignedGuest || !isAuthenticated) return;
    setIsProcessing(true);
    setErrorMsg(null);
    const ok = await revertLastDrink(assignedGuest.id);
    setIsProcessing(false);
    if (ok) {
      setServedSuccess('Drink reverted (-1)');
      setTimeout(() => setServedSuccess(null), 3000);
    } else {
      setErrorMsg('No active drink to revert for this guest.');
    }
  };

  // Staff First-tap wristband assignment
  const handleFirstTapAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !isAuthenticated) return;

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

  const tagLabel = parsedTag.tagNumber ? `Wristband #${parsedTag.tagNumber}` : tagId;

  return (
    <div className="w-full py-6 flex flex-col justify-center max-w-sm mx-auto">
      {/* CASE 0: Loading State */}
      {isLoading ? (
        <div className="glass-card p-10 text-center border border-black/15 shadow-xl animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center mx-auto mb-4 border border-black/10">
            <Loader2 className="w-6 h-6 text-black animate-spin" />
          </div>
          <span className="font-mono text-[10px] text-black/50 block tracking-widest uppercase mb-1">
            CHECKING WRISTBAND
          </span>
          <h2 className="font-display text-2xl font-bold lowercase text-black mb-2">
            {tagLabel}
          </h2>
          <p className="font-sans-clean text-xs text-black/50 lowercase">
            verifying pass status in database...
          </p>
        </div>
      ) : !assignedGuest ? (
        /* CASE 1: Unassigned Wristband */
        isAuthenticated ? (
          /* Staff View on Unassigned Tag: Fast Registration Form */
          <div className="glass-card p-6 sm:p-8 text-center border border-black/15 shadow-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-sans-clean font-bold uppercase tracking-wider mb-4">
              <ShieldCheck className="w-3 h-3" />
              <span>STAFF TERMINAL</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center mx-auto mb-3 border border-black/10">
              <Sparkles className="w-6 h-6 text-black" />
            </div>
            <span className="font-mono text-[10px] text-black/50 block tracking-widest uppercase mb-1">
              FIRST TAP DETECTED
            </span>
            <h2 className="font-display text-3xl font-bold lowercase text-black mb-1">
              assign guest
            </h2>
            <div className="inline-block px-3 py-1 rounded-full bg-black/5 font-mono text-xs font-bold text-black mb-5">
              {tagLabel}
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
          </div>
        ) : (
          /* Regular Guest View on Unassigned Tag: Friendly Notice */
          <div className="glass-card p-8 text-center border border-black/15 shadow-xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center mx-auto text-black border border-black/10">
              <DoorOpen className="w-7 h-7" />
            </div>
            <span className="font-mono text-[10px] text-black/40 uppercase tracking-widest block">
              HALLOWEEN PARTY PASS
            </span>
            <h2 className="font-display text-3xl font-bold lowercase text-black">
              wristband not active
            </h2>
            <div className="inline-block px-3.5 py-1 rounded-full bg-black/5 font-mono text-xs font-bold text-black">
              {tagLabel}
            </div>
            <p className="font-sans-clean text-xs text-black/60 leading-relaxed max-w-xs mx-auto">
              This wristband has not been activated yet. Please present it at the front door reception to check in.
            </p>

            <div className="pt-6 border-t border-black/10">
              <button
                type="button"
                onClick={() => setIsPinModalOpen(true)}
                className="font-sans-clean text-[11px] text-black/40 hover:text-black lowercase flex items-center justify-center gap-1.5 mx-auto transition-colors"
              >
                <Lock className="w-3 h-3" />
                <span>staff unlock</span>
              </button>
            </div>
          </div>
        )
      ) : (
        /* CASE 2: Assigned Active Guest Pass */
        <div className="space-y-4">
          {/* Staff Mode Header Banner (only visible to authenticated staff) */}
          {isAuthenticated && (
            <div className="p-3 rounded-2xl bg-black text-white text-xs font-sans-clean flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold tracking-wide uppercase text-[10px]">Staff Mode Active</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/barman')}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-semibold flex items-center gap-1"
                >
                  <GlassWater className="w-3 h-3" />
                  <span>Barman Desk</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  title="Lock Staff Terminal"
                  className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Main Card */}
          <div className="glass-card p-6 sm:p-8 border border-black/15 shadow-xl space-y-6">
            {/* Header Badges */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-black/50 font-bold">
                {tagLabel}
              </span>
              {assignedGuest.category === 'vip' ? (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                  VIP Host
                </span>
              ) : assignedGuest.category === 'driver_minor' ? (
                <span className="bg-blue-100 text-blue-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                  Driver / 0 Alc
                </span>
              ) : (
                <span className="bg-black/5 text-black/70 text-[10px] font-semibold px-2.5 py-0.5 rounded-full lowercase">
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
                  : isLimitReached
                  ? 'maximum limit reached'
                  : `${Math.max(0, effectiveLimit - assignedGuest.drinks_consumed)} drinks remaining`}
              </span>

              {assignedGuest.entered_at && (
                <div className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-sans-clean text-black/40">
                  <Clock className="w-3 h-3" />
                  <span>
                    checked in at{' '}
                    {new Date(assignedGuest.entered_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Limit Reached Banner */}
            {isLimitReached && (
              <div className="p-4 rounded-2xl bg-red-600 text-white text-center shadow-lg">
                <AlertOctagon className="w-8 h-8 text-white mx-auto mb-1 animate-pulse" />
                <span className="font-display text-lg font-bold lowercase block">limit reached</span>
                <span className="font-sans-clean text-xs text-white/90">
                  Alcohol service cut off. Water & soft drinks only.
                </span>
              </div>
            )}

            {/* Action Feedback Toast */}
            {servedSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 text-center border border-emerald-200 animate-in fade-in duration-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-0.5" />
                <span className="font-sans-clean text-xs font-bold block">{servedSuccess}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-sans-clean text-center border border-red-200">
                {errorMsg}
              </div>
            )}

            {/* ============================================================== */}
            {/* VIEW A: AUTHENTICATED STAFF ACTIONS (Authorized Bar Staff Only) */}
            {/* ============================================================== */}
            {isAuthenticated ? (
              <div className="space-y-2 pt-2 border-t border-black/10">
                <span className="font-mono text-[10px] text-black/50 uppercase tracking-widest block text-center mb-1">
                  BARMAN LOGGING CONTROLS
                </span>

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

                {/* Undo last drink for accidental taps */}
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={isProcessing || assignedGuest.drinks_consumed === 0}
                  className="w-full py-2.5 px-3 rounded-xl bg-black/5 hover:bg-black/10 text-black/70 hover:text-black font-sans-clean text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors mt-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>undo last drink (-1)</span>
                </button>
              </div>
            ) : (
              /* ============================================================== */
              /* VIEW B: UNAUTHORIZED / REGULAR GUEST VIEW (Strict Read-Only)  */
              /* ============================================================== */
              <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/10 text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-black font-sans-clean font-semibold text-xs">
                  <Shield className="w-3.5 h-3.5 text-black/60" />
                  <span>official party wristband</span>
                </div>
                <p className="font-sans-clean text-[11px] text-black/50 leading-relaxed max-w-xs mx-auto">
                  Drinks are verified and logged directly at the bar. Enjoy responsibly!
                </p>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(true)}
                    className="font-sans-clean text-[10px] text-black/30 hover:text-black/60 lowercase flex items-center justify-center gap-1 mx-auto transition-colors"
                  >
                    <Lock className="w-2.5 h-2.5" />
                    <span>staff terminal login</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Staff PIN Authorization Modal */}
      <AdminPinModal
        isOpen={isPinModalOpen}
        title="staff authorization"
        subtitle="enter staff pin to unlock terminal controls"
        onSuccess={() => setIsPinModalOpen(false)}
        onClose={() => setIsPinModalOpen(false)}
      />
    </div>
  );
}
