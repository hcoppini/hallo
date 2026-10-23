'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { Guest, GuestCategory, DrinkType, BAR_DRINKS } from '@/lib/types';
import { parseTagId, findGuestByTag } from '@/lib/tag-utils';
import {
  useStaffAuth,
  getStaffActiveDrinkType,
  getStaffStationMode,
} from '@/lib/auth';
import {
  sendTagRelayMessage,
  subscribeToTagRelay,
  attemptAutoCloseTab,
} from '@/lib/tag-relay';
import { AdminPinModal } from '@/components/AdminPinModal';
import { GuestDashboard } from '@/components/GuestDashboard';
import {
  Sparkles,
  UserCheck,
  ShieldCheck,
  Beer,
  GlassWater,
  Wine,
  CheckCircle2,
  Loader2,
  RotateCcw,
  LogOut,
  ArrowLeft,
  Wifi,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundSystem } from '@/lib/audio';

const categoryIcons: Record<'beer' | 'cocktail' | 'shot' | 'wine', React.ElementType> = {
  beer: Beer,
  cocktail: Sparkles,
  shot: GlassWater,
  wine: Wine,
};

export default function DirectTapPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || '';
  const parsedTag = parseTagId(rawId);
  const tagId = parsedTag.canonicalTag || parsedTag.decoded.toUpperCase();

  const {
    guests,
    logs,
    settings,
    serveDrink,
    revertLastDrink,
    checkIn,
    fetchGuestByTag,
    setSelectedGuestId,
  } = usePartyStore();
  const {
    isAuthenticated,
    stationMode,
    activeDrinkType,
    setStationMode,
    setActiveDrinkType,
    logout,
  } = useStaffAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [servedSuccess, setServedSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [relayedStation, setRelayedStation] = useState<'barman' | 'door' | null>(null);

  // Auto-serve state for staff phone NFC taps
  const hasAutoServedRef = useRef(false);
  const hasSentInitialTapRelayRef = useRef(false);
  const [autoServedResult, setAutoServedResult] = useState<{
    status: 'served' | 'limit_reached' | 'driver_minor' | 'none';
    message?: string;
  }>({ status: 'none' });
  const [undoSeconds, setUndoSeconds] = useState(0);

  // Secret staff unlock trigger: 5 rapid taps on the title (kept alongside footer lock button)
  const [, setSecretTapCount] = useState(0);
  const secretTapTimer = useRef<NodeJS.Timeout | null>(null);

  // Quick Registration Form State (only for staff on unassigned wristbands)
  const [guestName, setGuestName] = useState('');
  const [category, setCategory] = useState<GuestCategory>('standard');

  // 0. Real-time Tab Relay & Duplicate Tab Cleanup:
  useEffect(() => {
    if (!tagId) return;

    sendTagRelayMessage({
      type: 'NEW_TAP_TAB_OPENED',
      tagId,
      rawId,
    });

    sendTagRelayMessage({
      type: 'PING_STATION',
      tagId,
      rawId,
    });

    const unsubscribe = subscribeToTagRelay(msg => {
      if (msg.type === 'STATION_ACK' && msg.station) {
        setRelayedStation(msg.station);
        if (msg.station === 'door') {
          attemptAutoCloseTab();
        }
      } else if (msg.type === 'NEW_TAP_TAB_OPENED' && msg.tagId) {
        attemptAutoCloseTab();
        if (msg.tagId !== tagId) {
          router.replace(`/t/${encodeURIComponent(msg.tagId)}`);
        }
      }
    });

    return () => unsubscribe();
  }, [tagId, rawId, router]);

  // 1. Initial lookup on mount: query store & Supabase
  const guestsRef = useRef(guests);
  useEffect(() => {
    guestsRef.current = guests;
  }, [guests]);

  useEffect(() => {
    let isMounted = true;
    hasAutoServedRef.current = false;
    hasSentInitialTapRelayRef.current = false;

    async function loadWristband() {
      setIsLoading(true);
      setErrorMsg(null);

      // Fast check in memory first
      const memGuest = findGuestByTag(guestsRef.current, tagId);
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
  }, [tagId, fetchGuestByTag]);

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

  // Broadcast TAG_TAPPED to any open /door or /barman dashboard once wristband state is resolved
  useEffect(() => {
    if (isLoading || !tagId || hasSentInitialTapRelayRef.current) return;
    hasSentInitialTapRelayRef.current = true;

    sendTagRelayMessage(
      {
        type: 'TAG_TAPPED',
        tagId: assignedGuest?.tag_id || tagId,
        rawId,
        guestName: assignedGuest?.name || null,
        isAssigned,
      },
      { broadcastCrossDevice: isAuthenticated }
    );
  }, [isLoading, tagId, rawId, assignedGuest, isAssigned, isAuthenticated]);

  const effectiveLimit = assignedGuest
    ? calculateEffectiveLimit(assignedGuest, settings)
    : settings.default_drink_limit;

  const isLimitReached = Boolean(
    assignedGuest &&
    assignedGuest.category !== 'vip' &&
    assignedGuest.drinks_consumed >= effectiveLimit
  );

  // 3. Select guest in store & auto-serve on staff phones (when in 'barman' station mode)
  useEffect(() => {
    if (isAuthenticated && assignedGuest) {
      setSelectedGuestId(assignedGuest.id);
    }
  }, [isAuthenticated, assignedGuest, setSelectedGuestId]);

  useEffect(() => {
    if (!isAuthenticated || !assignedGuest || isLoading || hasAutoServedRef.current) return;

    if (relayedStation === 'door' || getStaffStationMode() === 'door') {
      hasAutoServedRef.current = true;
      return;
    }

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

      await new Promise(resolve => setTimeout(resolve, 80));
      if (getStaffStationMode() === 'door') return;

      if (assignedGuest.category === 'driver_minor') {
        soundSystem.playErrorSound();
        setAutoServedResult({
          status: 'driver_minor',
          message: 'Driver / Minor: 0 alcohol permitted. Soft drinks only.',
        });
        return;
      }

      const curLimit = calculateEffectiveLimit(assignedGuest, settings);
      if (assignedGuest.category !== 'vip' && assignedGuest.drinks_consumed >= curLimit) {
        soundSystem.playCutoffSound();
        setAutoServedResult({
          status: 'limit_reached',
          message: `Limit reached (${assignedGuest.drinks_consumed}/${curLimit}). Do not serve alcohol.`,
        });
        return;
      }

      const preferredDrink = (getStaffActiveDrinkType() as DrinkType) || 'beer';
      setIsProcessing(true);
      const res = await serveDrink(assignedGuest.tag_id, preferredDrink);
      setIsProcessing(false);

      sendTagRelayMessage(
        {
          type: 'DRINK_SERVED',
          tagId: assignedGuest.tag_id,
          drinkType: preferredDrink,
          result: res,
        },
        { broadcastCrossDevice: true }
      );

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
        if (relayedStation === 'barman') {
          attemptAutoCloseTab();
        }
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
  }, [isAuthenticated, assignedGuest, isLoading, settings, serveDrink, relayedStation]);

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
    setActiveDrinkType(type);
    setIsProcessing(true);
    setErrorMsg(null);
    const res = await serveDrink(assignedGuest.tag_id, type);
    setIsProcessing(false);

    sendTagRelayMessage(
      {
        type: 'DRINK_SERVED',
        tagId: assignedGuest.tag_id,
        drinkType: type,
        result: res,
      },
      { broadcastCrossDevice: true }
    );

    if (res.success) {
      soundSystem.playApprovedSound();
      setServedSuccess(`Logged ${type} (+1)`);
      setAutoServedResult({
        status: 'served',
        message: `Logged ${type} (+1)`,
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

  // Secret 5-tap gesture to unlock staff mode
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

      hasAutoServedRef.current = true;

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

  const guestIdParsed = assignedGuest ? parseTagId(assignedGuest.tag_id || assignedGuest.id) : null;
  const displayTagNum = guestIdParsed?.tagNumber ?? parsedTag.tagNumber;
  const tagLabel = displayTagNum ? `Wristband #${displayTagNum}` : tagId;

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
          <div className="space-y-3">
            {relayedStation === 'door' && (
              <div className="p-3 rounded-2xl bg-emerald-600 text-white text-xs font-sans-clean font-bold text-center shadow-lg flex items-center justify-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" />
                <span>Sent to Open Door Check-In Tab!</span>
              </div>
            )}

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
          </div>
        ) : (
          /* Non-Authenticated Phone on Unassigned Tag: Guest Dashboard */
          <GuestDashboard
            assignedGuest={null}
            tagLabel={tagLabel}
            guests={guests}
            logs={logs}
            settings={settings}
            onSecretTap={handleSecretTap}
            onOpenStaffPin={() => setIsPinModalOpen(true)}
          />
        )
      ) : (
        /* CASE 2: Assigned Active Guest Pass */
        <div className="space-y-4">
          {isAuthenticated ? (
            <div className="space-y-4">
              {/* Staff Navigation & Station Mode Header */}
              <div className="p-3 rounded-2xl bg-black text-white text-xs font-sans-clean space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        stationMode === 'door'
                          ? '/door'
                          : `/barman?tag=${encodeURIComponent(assignedGuest.tag_id)}`
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{stationMode === 'door' ? 'Door Desk' : 'Open in Barman Station'}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-emerald-400 uppercase font-bold tracking-wider flex items-center gap-1">
                      <Wifi className="w-3 h-3" />
                      {relayedStation ? `Synced (${relayedStation})` : 'Staff Phone'}
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

                {/* 1-Tap Station Mode Toggle: Bar Auto-Serve vs Door Inspect */}
                <div className="grid grid-cols-2 gap-1.5 bg-white/10 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setStationMode('barman')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      stationMode === 'barman'
                        ? 'bg-emerald-500 text-black shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    🍸 Bar Mode (Auto +1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStationMode('door')}
                    className={`py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      stationMode === 'door'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    🚪 Door Mode (Inspect)
                  </button>
                </div>
              </div>

              {servedSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-600 text-white text-xs font-sans-clean font-bold text-center shadow-md">
                  {servedSuccess}
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-2xl bg-red-600 text-white text-xs font-sans-clean font-bold text-center shadow-md">
                  {errorMsg}
                </div>
              )}

              {/* Status Alert Banners */}
              {autoServedResult.status === 'served' && (
                <div className="rounded-3xl bg-emerald-600 text-white p-5 text-center shadow-xl space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <CheckCircle2 className="w-10 h-10 text-white mx-auto" />
                  <div className="font-sans-clean text-xs font-bold">
                    {servedSuccess || autoServedResult.message}
                  </div>
                  {undoSeconds > 0 && (
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={isProcessing}
                      className="w-full py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-sans-clean font-bold text-xs flex items-center justify-center gap-2 border border-white/30 transition-all mt-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Undo Last Drink (-1) [{undoSeconds}s]</span>
                    </button>
                  )}
                </div>
              )}

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

                {/* Specific Drink Controls */}
                <div className="space-y-3 pt-3 border-t border-black/10">
                  <span className="font-mono text-[10px] text-black/40 uppercase tracking-widest block text-center">
                    SERVE DRINK / SET DEFAULT FOR NEXT TAP
                  </span>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {BAR_DRINKS.map(({ type, label, category }) => {
                      const Icon = categoryIcons[category];
                      const isActive = activeDrinkType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleServe(type)}
                          disabled={isProcessing || isLimitReached}
                          className={`px-3.5 py-2 rounded-xl text-xs font-sans-clean font-semibold lowercase flex items-center gap-1.5 border transition-colors disabled:opacity-40 ${
                            isActive
                              ? 'bg-black text-white border-black shadow-sm'
                              : 'bg-black/5 hover:bg-black hover:text-white text-black border-black/10'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {assignedGuest.drinks_consumed > 0 && undoSeconds === 0 && (
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={isProcessing}
                      className="w-full py-2.5 rounded-xl bg-black/5 hover:bg-black/10 text-black/70 hover:text-black font-sans-clean text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors mt-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Revert 1 Drink (-1)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => router.push(`/barman?tag=${encodeURIComponent(assignedGuest.tag_id)}`)}
                    className="w-full py-3 rounded-xl bg-black text-white hover:bg-black/90 font-sans-clean text-xs font-bold flex items-center justify-center gap-1.5 transition-colors mt-2"
                  >
                    <span>Open Full Barman Station</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* VIEW B: GUEST DASHBOARD — FIRST POPUP FOR NON-AUTHENTICATED PHONES */
            <GuestDashboard
              assignedGuest={assignedGuest}
              tagLabel={tagLabel}
              guests={guests}
              logs={logs}
              settings={settings}
              onSecretTap={handleSecretTap}
              onOpenStaffPin={() => setIsPinModalOpen(true)}
            />
          )}
        </div>
      )}

      {/* Staff PIN Authorization Modal */}
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
