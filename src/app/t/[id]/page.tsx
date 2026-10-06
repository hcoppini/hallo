'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { Guest, GuestCategory, DrinkType } from '@/lib/types';
import { parseTagId, findGuestByTag, getGuestDisplayName } from '@/lib/tag-utils';
import { useStaffAuth, getStaffActiveDrinkType } from '@/lib/auth';
import { AdminPinModal } from '@/components/AdminPinModal';
import {
  Sparkles,
  UserCheck,
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
  ArrowLeft,
  Wine,
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

  // Auto-serve state for staff phone NFC taps
  const hasAutoServedRef = useRef(false);
  const [autoServedResult, setAutoServedResult] = useState<{
    status: 'served' | 'limit_reached' | 'driver_minor' | 'none';
    message?: string;
  }>({ status: 'none' });
  const [undoSeconds, setUndoSeconds] = useState(0);

  // Secret staff unlock trigger: 5 rapid taps on the title
  const [secretTapCount, setSecretTapCount] = useState(0);
  const secretTapTimer = useRef<NodeJS.Timeout | null>(null);

  // Quick Registration Form State (only for staff on unassigned wristbands)
  const [guestName, setGuestName] = useState('');
  const [category, setCategory] = useState<GuestCategory>('standard');

  // 1. Initial lookup on mount: query store & Supabase
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

  // Is this wristband assigned to an admitted guest?
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

  // 3. AUTO-SERVE ON STAFF PHONES:
  // When an authorized staff phone opens this tag page via NFC tap, auto-log the drink!
  useEffect(() => {
    if (!isAuthenticated || !assignedGuest || isLoading || hasAutoServedRef.current) return;

    // Allow view-only mode if URL contains ?mode=view
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('mode') === 'view' || sp.get('noserve') === '1') {
        hasAutoServedRef.current = true;
        return;
      }
    }

    hasAutoServedRef.current = true;

    async function executeAutoServe() {
      if (!assignedGuest) return;

      // Check if driver / minor
      if (assignedGuest.category === 'driver_minor') {
        soundSystem.playErrorSound();
        setAutoServedResult({
          status: 'driver_minor',
          message: 'Driver / Minor: 0 alcohol permitted. Soft drinks only.',
        });
        return;
      }

      // Check if limit reached
      const curLimit = calculateEffectiveLimit(assignedGuest, settings);
      if (assignedGuest.category !== 'vip' && assignedGuest.drinks_consumed >= curLimit) {
        soundSystem.playCutoffSound();
        setAutoServedResult({
          status: 'limit_reached',
          message: `Limit reached (${assignedGuest.drinks_consumed}/${curLimit}). Do not serve alcohol.`,
        });
        return;
      }

      // Execute auto-serve with staff's active drink preference
      const preferredDrink = (getStaffActiveDrinkType() as DrinkType) || 'cocktail';
      setIsProcessing(true);
      const res = await serveDrink(assignedGuest.tag_id, preferredDrink);
      setIsProcessing(false);

      if (res.success) {
        soundSystem.playApprovedSound();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
        setAutoServedResult({
          status: 'served',
          message: `Logged ${preferredDrink} (+1)`,
        });
        setUndoSeconds(10);
      } else {
        if (res.error === 'LIMIT_REACHED') {
          soundSystem.playCutoffSound();
          setAutoServedResult({
            status: 'limit_reached',
            message: res.message || 'Drink limit reached.',
          });
        } else {
          soundSystem.playErrorSound();
          setErrorMsg(res.message || 'Failed to log drink.');
        }
      }
    }

    executeAutoServe();
  }, [isAuthenticated, assignedGuest, isLoading, settings, serveDrink]);

  // Undo 10-second countdown timer
  useEffect(() => {
    if (undoSeconds <= 0) return;
    const interval = setInterval(() => {
      setUndoSeconds(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [undoSeconds]);

  // Handle Undo Last Drink
  const handleUndo = async () => {
    if (!assignedGuest || !isAuthenticated) return;
    setIsProcessing(true);
    setErrorMsg(null);
    const ok = await revertLastDrink(assignedGuest.id);
    setIsProcessing(false);
    if (ok) {
      soundSystem.playUndoSound();
      setUndoSeconds(0);
      setAutoServedResult({ status: 'none', message: 'Drink reverted (-1)' });
      setServedSuccess('Drink reverted (-1)');
      setTimeout(() => setServedSuccess(null), 3000);
    } else {
      setErrorMsg('No active drink to revert for this guest.');
    }
  };

  // Handle Manual Drink Selection for Staff
  const handleServe = async (type: DrinkType) => {
    if (!assignedGuest || !isAuthenticated) return;
    setIsProcessing(true);
    setErrorMsg(null);
    const res = await serveDrink(assignedGuest.tag_id, type);
    setIsProcessing(false);

    if (res.success) {
      soundSystem.playApprovedSound();
      const typeName = type === 'soft' ? 'soft drink' : type;
      setServedSuccess(`Logged ${typeName} (+1)`);
      setAutoServedResult({
        status: 'served',
        message: `Logged ${typeName} (+1)`,
      });
      setUndoSeconds(10);
      setTimeout(() => setServedSuccess(null), 3000);
    } else {
      if (res.error === 'LIMIT_REACHED') {
        soundSystem.playCutoffSound();
      } else {
        soundSystem.playErrorSound();
      }
      setErrorMsg(res.message || 'Drink limit reached or error');
    }
  };

  // Secret 5-tap gesture to unlock staff mode on a guest phone without revealing buttons
  const handleSecretTap = () => {
    if (isAuthenticated) return;
    setSecretTapCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setIsPinModalOpen(true);
        return 0;
      }
      return next;
    });

    if (secretTapTimer.current) clearTimeout(secretTapTimer.current);
    secretTapTimer.current = setTimeout(() => {
      setSecretTapCount(0);
    }, 2000);
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
    <div className="w-full py-4 flex flex-col justify-center max-w-sm mx-auto">
      {/* CASE 0: Loading State */}
      {isLoading ? (
        <div className="glass-card p-10 text-center border border-black/15 shadow-xl animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center mx-auto mb-4 border border-black/10">
            <Loader2 className="w-6 h-6 text-black animate-spin" />
          </div>
          <span className="font-mono text-[10px] text-black/50 block tracking-widest uppercase mb-1">
            VERIFYING PASS
          </span>
          <h2 className="font-display text-2xl font-bold lowercase text-black mb-2">
            {tagLabel}
          </h2>
          <p className="font-sans-clean text-xs text-black/50 lowercase">
            loading guest pass...
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
          /* Regular Guest View on Unassigned Tag: Friendly Notice (NO PIN / LOGIN PROMPT) */
          <div className="glass-card p-8 text-center border border-black/15 shadow-xl space-y-4">
            <div
              onClick={handleSecretTap}
              className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center mx-auto text-black border border-black/10 cursor-pointer select-none"
            >
              <DoorOpen className="w-7 h-7" />
            </div>
            <span
              onClick={handleSecretTap}
              className="font-mono text-[10px] text-black/40 uppercase tracking-widest block cursor-pointer select-none"
            >
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
          </div>
        )
      ) : (
        /* CASE 2: Assigned Active Guest Pass */
        <div className="space-y-4">
          {/* ============================================================== */}
          {/* VIEW A: AUTHENTICATED STAFF TERMINAL (The Bartender's Phone)   */}
          {/* ============================================================== */}
          {isAuthenticated ? (
            <div className="space-y-4">
              {/* Staff Navigation Header */}
              <div className="p-3 rounded-2xl bg-black text-white text-xs font-sans-clean flex items-center justify-between shadow-lg">
                <button
                  type="button"
                  onClick={() => router.push('/barman')}
                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Bar Desk</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
                    Staff Phone
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    title="Lock Terminal"
                    className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Status Alert Banners */}
              {isLimitReached || autoServedResult.status === 'limit_reached' ? (
                /* RED CUT-OFF ALERT */
                <div className="rounded-3xl bg-red-600 text-white p-6 text-center shadow-2xl animate-pulse border-4 border-white/20 space-y-3">
                  <AlertOctagon className="w-12 h-12 text-white mx-auto" />
                  <div>
                    <h2 className="font-display text-3xl font-bold lowercase text-white">
                      limit reached
                    </h2>
                    <p className="font-sans-clean text-xs text-white/95 font-semibold mt-1">
                      DO NOT SERVE ALCOHOL
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-black/25 text-xs text-white/90 font-sans-clean">
                    {assignedGuest.name} has consumed {assignedGuest.drinks_consumed} of {effectiveLimit} drinks.
                    Water and soft drinks only.
                  </div>
                  <button
                    type="button"
                    onClick={() => handleServe('soft')}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl bg-white text-red-700 font-sans-clean font-bold text-xs shadow-md hover:bg-white/90 transition-colors"
                  >
                    Log Soft Drink (Water / Cola)
                  </button>
                </div>
              ) : assignedGuest.category === 'driver_minor' ? (
                /* BLUE DRIVER / MINOR ALERT */
                <div className="rounded-3xl bg-blue-600 text-white p-6 text-center shadow-xl space-y-3">
                  <Shield className="w-10 h-10 text-white mx-auto" />
                  <h2 className="font-display text-2xl font-bold lowercase text-white">
                    driver / minor (0 alcohol)
                  </h2>
                  <p className="font-sans-clean text-xs text-white/90">
                    This guest is registered with zero alcohol limit. Soft drinks only.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleServe('soft')}
                    disabled={isProcessing}
                    className="w-full py-3 rounded-xl bg-white text-blue-700 font-sans-clean font-bold text-xs shadow-md hover:bg-white/90 transition-colors"
                  >
                    Log Soft Drink (Water / Cola)
                  </button>
                </div>
              ) : autoServedResult.status === 'served' ? (
                /* GREEN AUTO-SERVED CONFIRMATION */
                <div className="rounded-3xl bg-emerald-600 text-white p-6 text-center shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <CheckCircle2 className="w-12 h-12 text-white mx-auto" />
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-200 font-bold block">
                      AUTO-LOGGED ON TAP
                    </span>
                    <h2 className="font-display text-3xl font-bold lowercase text-white mt-1">
                      {assignedGuest.name}
                    </h2>
                  </div>
                  <div className="text-3xl font-display font-bold text-white">
                    {assignedGuest.drinks_consumed}{' '}
                    <span className="text-xl font-normal text-white/70">
                      / {assignedGuest.category === 'vip' ? '∞' : effectiveLimit}
                    </span>
                  </div>
                  <span className="font-sans-clean text-xs text-emerald-100 font-semibold block">
                    {assignedGuest.category === 'vip'
                      ? 'VIP Host (Unlimited)'
                      : `${Math.max(0, effectiveLimit - assignedGuest.drinks_consumed)} drinks remaining`}
                  </span>

                  {/* 10-Second Undo Button */}
                  {undoSeconds > 0 && (
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={isProcessing}
                      className="w-full py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-sans-clean font-bold text-xs flex items-center justify-center gap-2 border border-white/30 transition-all mt-2"
                    >
                      <RotateCcw className="w-4 h-4 animate-spin-slow" />
                      <span>Undo Last Drink (-1) [{undoSeconds}s]</span>
                    </button>
                  )}
                </div>
              ) : null}

              {/* Main Card */}
              <div className="glass-card p-6 border border-black/15 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-black/50 font-bold">{tagLabel}</span>
                  <span className="bg-black/5 text-black/70 text-[10px] font-semibold px-2.5 py-0.5 rounded-full lowercase">
                    {assignedGuest.category === 'vip'
                      ? 'vip host'
                      : assignedGuest.category === 'driver_minor'
                      ? 'driver (0 alc)'
                      : 'standard 18+'}
                  </span>
                </div>

                <div className="text-center">
                  <h2 className="font-display text-3xl font-bold lowercase text-black mb-1">
                    {assignedGuest.name}
                  </h2>
                  <div className="font-display text-5xl font-bold text-black my-1">
                    {assignedGuest.drinks_consumed}
                    <span className="text-2xl text-black/30 font-normal">
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
                </div>

                {/* Quick Drink Switch / Manual Controls */}
                <div className="space-y-2 pt-3 border-t border-black/10">
                  <span className="font-mono text-[10px] text-black/40 uppercase tracking-widest block text-center mb-1">
                    CHANGE DRINK TYPE
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleServe('cocktail')}
                      disabled={isProcessing || isLimitReached}
                      className="p-2.5 rounded-xl bg-black text-white text-[11px] font-sans-clean font-bold flex flex-col items-center gap-1 hover:opacity-90 disabled:opacity-40"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Cocktail</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleServe('beer')}
                      disabled={isProcessing || isLimitReached}
                      className="p-2.5 rounded-xl bg-black/5 hover:bg-black/10 text-black text-[11px] font-sans-clean font-bold flex flex-col items-center gap-1 border border-black/10 disabled:opacity-40"
                    >
                      <Beer className="w-4 h-4" />
                      <span>Beer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleServe('soft')}
                      disabled={isProcessing}
                      className="p-2.5 rounded-xl bg-black/5 hover:bg-black/10 text-black text-[11px] font-sans-clean font-bold flex flex-col items-center gap-1 border border-black/10"
                    >
                      <CupSoda className="w-4 h-4" />
                      <span>Soft Drink</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push('/barman')}
                    className="w-full py-3 rounded-xl bg-black/5 hover:bg-black/10 text-black font-sans-clean text-xs font-bold flex items-center justify-center gap-1.5 transition-colors mt-3"
                  >
                    <span>Return to Bar Desk</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* VIEW B: GUEST VIEW — STRICTLY READ-ONLY (Tamper-Proof)        */
            /* ============================================================== */
            <div className="glass-card p-6 sm:p-8 border border-black/15 shadow-xl space-y-6">
              {/* Header Badges */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-black/50 font-bold">{tagLabel}</span>
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
                <span
                  onClick={handleSecretTap}
                  className="font-mono text-[10px] text-black/40 uppercase tracking-widest block mb-1 cursor-pointer select-none"
                >
                  OFFICIAL PARTY PASS
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

              {/* Limit Reached Banner for Guest */}
              {isLimitReached && (
                <div className="p-4 rounded-2xl bg-red-600 text-white text-center shadow-lg">
                  <AlertOctagon className="w-8 h-8 text-white mx-auto mb-1 animate-pulse" />
                  <span className="font-display text-lg font-bold lowercase block">limit reached</span>
                  <span className="font-sans-clean text-xs text-white/90">
                    Alcohol service cut off. Water & soft drinks only.
                  </span>
                </div>
              )}

              {/* Read-Only Guest Information Note */}
              <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/10 text-center space-y-1.5">
                <div className="flex items-center justify-center gap-1.5 text-black font-sans-clean font-semibold text-xs">
                  <Shield className="w-3.5 h-3.5 text-black/60" />
                  <span>drinks are logged at the bar</span>
                </div>
                <p className="font-sans-clean text-[11px] text-black/50 leading-relaxed max-w-xs mx-auto">
                  Show your wristband to the bartender to order your next drink. Enjoy responsibly!
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Secret Staff PIN Authorization Modal (only triggers if staff uses 5-tap gesture) */}
      <AdminPinModal
        isOpen={isPinModalOpen}
        title="staff authorization"
        subtitle="enter staff pin to unlock terminal controls on this phone"
        onSuccess={() => setIsPinModalOpen(false)}
        onClose={() => setIsPinModalOpen(false)}
      />
    </div>
  );
}
