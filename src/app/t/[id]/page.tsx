'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import { Guest, DrinkType, BAR_DRINKS } from '@/lib/types';
import {
  parseTagId,
  findGuestByTag,
  isUniversalOnboardingTag,
  getNextFreeTagId,
  stripUidFromNotes,
} from '@/lib/tag-utils';
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
import { GuestOnboardingCard } from '@/components/GuestOnboardingCard';
import {
  Sparkles,
  Beer,
  GlassWater,
  Wine,
  CheckCircle2,
  Loader2,
  RotateCcw,
  LogOut,
  ArrowLeft,
  Wifi,
  Copy,
  Check,
  UserPlus,
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
  const isUniversal = isUniversalOnboardingTag(rawId);
  const parsedTag = parseTagId(rawId);
  const tagId = isUniversal
    ? 'UNIVERSAL'
    : parsedTag.canonicalTag || parsedTag.decoded.toUpperCase();

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

  const nextFreeTag = useMemo(() => getNextFreeTagId(guests), [guests]);
  const [selectedSlotOverride, setSelectedSlotOverride] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(!isUniversal);
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [justOnboarded, setJustOnboarded] = useState(false);
  const [copiedPassUrl, setCopiedPassUrl] = useState(false);
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

  // Secret staff unlock trigger: 5 rapid taps on the title (kept alongside lock button)
  const [, setSecretTapCount] = useState(0);
  const secretTapTimer = useRef<NodeJS.Timeout | null>(null);

  // Check if URL has ?onboarded=1 from a universal link redirect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('onboarded') === '1') {
        setJustOnboarded(true);
        hasAutoServedRef.current = true;
      }
    }
  }, [rawId]);

  // 0. Real-time Tab Relay & Duplicate Tab Cleanup:
  useEffect(() => {
    if (!tagId || isUniversal) return;

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
  }, [tagId, rawId, isUniversal, router]);

  // 1. Initial lookup on mount: query store & Supabase (skipped for universal `/t/{UID}` links)
  const guestsRef = useRef(guests);
  useEffect(() => {
    guestsRef.current = guests;
  }, [guests]);

  useEffect(() => {
    let isMounted = true;
    hasAutoServedRef.current = false;
    hasSentInitialTapRelayRef.current = false;

    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('onboarded') === '1') {
        hasAutoServedRef.current = true;
      }
    }

    if (isUniversal) {
      setActiveGuest(null);
      setIsLoading(false);
      return;
    }

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
  }, [tagId, isUniversal, fetchGuestByTag]);

  // 2. Keep activeGuest synced if global store updates
  useEffect(() => {
    if (isUniversal) {
      setActiveGuest(null);
      return;
    }
    const updated = findGuestByTag(guests, tagId);
    if (updated) {
      setActiveGuest(updated);
    }
  }, [guests, tagId, isUniversal]);

  // Is this wristband assigned to an admitted guest?
  const isAssigned = Boolean(
    !isUniversal &&
      activeGuest &&
      activeGuest.is_entered &&
      activeGuest.name &&
      activeGuest.name.trim().length > 0
  );

  const assignedGuest = isAssigned && activeGuest ? activeGuest : null;

  // Broadcast TAG_TAPPED to any open /door or /barman dashboard once wristband state is resolved
  useEffect(() => {
    if (isLoading || !tagId || isUniversal || hasSentInitialTapRelayRef.current) return;
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
  }, [isLoading, tagId, rawId, isUniversal, assignedGuest, isAssigned, isAuthenticated]);

  const effectiveLimit = assignedGuest
    ? calculateEffectiveLimit(assignedGuest, settings)
    : settings.default_drink_limit;

  const isLimitReached = Boolean(
    assignedGuest &&
      assignedGuest.category !== 'vip' &&
      assignedGuest.drinks_consumed >= effectiveLimit
  );

  // 3. Select guest in store on staff phones (no forced auto-pour: staff explicitly selects drink)
  useEffect(() => {
    if (isAuthenticated && assignedGuest) {
      setSelectedGuestId(assignedGuest.id);
    }
  }, [isAuthenticated, assignedGuest, setSelectedGuestId]);

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

  // Handle completion of GuestOnboardingCard: turn /t/{UID} into /t/X!
  const handleOnboardingComplete = (checkedInGuest: Guest) => {
    hasAutoServedRef.current = true;
    setJustOnboarded(true);
    setActiveGuest(checkedInGuest);

    confetti({
      particleCount: 65,
      spread: 70,
      origin: { y: 0.6 },
    });

    const slotNum = parseTagId(checkedInGuest.tag_id).tagNumber ?? checkedInGuest.tag_id;
    router.replace(`/t/${encodeURIComponent(String(slotNum))}?onboarded=1${isUniversal ? '&from_uid=1' : ''}`);
  };

  const handleCopyActivePassUrl = () => {
    if (!assignedGuest || typeof window === 'undefined') return;
    const slotNum = parseTagId(assignedGuest.tag_id).tagNumber ?? assignedGuest.tag_id;
    const url = `${window.location.origin}/t/${slotNum}`;
    navigator.clipboard.writeText(url);
    soundSystem.playApprovedSound();
    setCopiedPassUrl(true);
    setTimeout(() => setCopiedPassUrl(false), 2500);
  };

  const onboardingTargetTag = isUniversal
    ? selectedSlotOverride || nextFreeTag
    : selectedSlotOverride || tagId;

  const guestIdParsed = assignedGuest
    ? parseTagId(assignedGuest.tag_id || assignedGuest.id)
    : null;
  const displayTagNum = guestIdParsed?.tagNumber ?? parsedTag.tagNumber;
  const tagLabel = isUniversal
    ? `Next Free: ${onboardingTargetTag}`
    : displayTagNum
    ? `Wristband #${displayTagNum} (${tagId})`
    : tagId;

  const cleanNotes = assignedGuest ? stripUidFromNotes(assignedGuest.notes) : '';

  return (
    <div className="w-full py-4 flex flex-col justify-center max-w-md lg:max-w-5xl xl:max-w-6xl mx-auto">
      {/* CASE 0: Loading State */}
      {isLoading ? (
        <div className="glass-card max-w-md mx-auto w-full p-10 text-center border border-black/15 shadow-xl animate-pulse">
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
        /* CASE 1: Unassigned Wristband OR Universal Link (/t/{UID}) */
        isAuthenticated ? (
          <div className="max-w-lg mx-auto w-full space-y-3">
            {isUniversal && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-sans-clean space-y-2 shadow-sm">
                <div className="font-bold text-amber-900 flex items-center justify-between">
                  <span>⚠️ Sticker has literal &quot;/t/&#123;UID&#125;&quot; written on it!</span>
                </div>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  Because iPhones block websites from reading NFC chip serial numbers, a sticker encoded with literal <code className="font-mono font-bold">/t/&#123;UID&#125;</code> cannot remember which guest it belongs to on future taps.
                </p>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  <strong>Fix for this sticker:</strong> In NFC Tools on iPhone, write <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-300">/t/{parseTagId(onboardingTargetTag).tagNumber ?? 4}</code> (e.g. <code className="font-mono font-bold">/t/4</code> for papai) onto the sticker so it permanently opens that guest!
                </p>
              </div>
            )}

            {relayedStation === 'door' && (
              <div className="p-3 rounded-2xl bg-emerald-600 text-white text-xs font-sans-clean font-bold text-center shadow-lg flex items-center justify-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" />
                <span>Synced with Open Door Check-In Desk!</span>
              </div>
            )}

            <GuestOnboardingCard
              targetTagId={onboardingTargetTag}
              isUniversalLink={isUniversal}
              guests={guests}
              settings={settings}
              onTargetTagChange={newTag => setSelectedSlotOverride(newTag)}
              onCheckIn={checkIn}
              onComplete={handleOnboardingComplete}
            />
          </div>
        ) : (
          /* Non-Authenticated Phone on Unassigned Tag: Prominent Unlock & Onboard CTA + Party Dashboard */
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
        <div className="w-full">
          {isAuthenticated ? (
            <div className="max-w-lg mx-auto w-full space-y-4">
              {/* Compact Staff Navigation Bar */}
              <div className="p-2.5 rounded-2xl bg-black text-white text-xs font-sans-clean flex items-center justify-between shadow-md">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        stationMode === 'door'
                          ? '/door'
                          : `/barman?tag=${encodeURIComponent(assignedGuest.tag_id)}`
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{stationMode === 'door' ? 'Door' : 'Barman Desk'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setJustOnboarded(false);
                      setSelectedSlotOverride(null);
                      router.push('/door');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>+ Onboard</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Wifi className="w-3 h-3" />
                    <span>Staff</span>
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    title="Lock Terminal"
                    className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Status Notifications */}
              {servedSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-600 text-white text-xs font-sans-clean font-bold text-center shadow-md animate-in fade-in duration-150">
                  {servedSuccess}
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-2xl bg-red-600 text-white text-xs font-sans-clean font-bold text-center shadow-md animate-in fade-in duration-150">
                  {errorMsg}
                </div>
              )}

              {/* Undo Toast Banner (Appears right after serving) */}
              {undoSeconds > 0 && (
                <div className="rounded-2xl bg-stone-900 text-white p-3 shadow-lg flex items-center justify-between border border-stone-800 animate-in fade-in duration-150">
                  <span className="text-xs text-stone-300 font-medium truncate">
                    {servedSuccess || 'Drink served (+1)'}
                  </span>
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={isProcessing}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-sans-clean font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Undo ({undoSeconds}s)</span>
                  </button>
                </div>
              )}

              {/* Fast POS Drink Card (Compact & Above the fold) */}
              <div className="glass-card p-5 border border-black/15 shadow-xl space-y-4">
                {/* Guest Summary Header */}
                <div className="flex items-center justify-between pb-3 border-b border-black/10">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-black text-white">
                        #{displayTagNum ?? assignedGuest.tag_id}
                      </span>
                      <span className="text-[11px] font-sans-clean font-semibold text-black/60 truncate">
                        {assignedGuest.tag_id}
                      </span>
                      {assignedGuest.category === 'vip' && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          VIP
                        </span>
                      )}
                      {assignedGuest.category === 'driver_minor' && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          0 Alc
                        </span>
                      )}
                    </div>
                    <h2 className="font-display text-2xl font-bold lowercase text-black truncate">
                      {assignedGuest.name}
                    </h2>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-display text-3xl font-bold text-black leading-none">
                      {assignedGuest.drinks_consumed}
                      <span className="text-xl text-black/30 font-normal">
                        /{assignedGuest.category === 'vip' ? '∞' : effectiveLimit}
                      </span>
                    </div>
                    <span className="font-sans-clean text-[11px] font-semibold text-black/55 block mt-0.5">
                      {assignedGuest.category === 'vip'
                        ? 'unlimited'
                        : isLimitReached
                        ? 'limit reached'
                        : `${Math.max(0, effectiveLimit - assignedGuest.drinks_consumed)} left`}
                    </span>
                  </div>
                </div>

                {/* 1-Tap Drink Selector Grid (Tap to Pour Instantly) */}
                <div className="space-y-2">
                  <span className="font-mono text-[10px] text-black/45 uppercase tracking-wider block font-bold">
                    TAP DRINK TO POUR:
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    {BAR_DRINKS.map(({ type, label, category }) => {
                      const Icon = categoryIcons[category];
                      const isSelected = activeDrinkType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleServe(type)}
                          disabled={isProcessing || isLimitReached}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            isSelected
                              ? 'bg-black text-white border-black shadow-sm'
                              : 'bg-white hover:bg-black/5 text-black border-black/15 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-black/60'}`} />
                            <span className="font-sans-clean text-xs font-bold capitalize">
                              {label}
                            </span>
                          </div>
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-white/60' : 'text-black/40'}`}>
                            +1
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Switch to Full Desk */}
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/barman?tag=${encodeURIComponent(assignedGuest.tag_id)}`)
                  }
                  className="w-full py-2.5 rounded-xl bg-black/5 hover:bg-black/10 text-black/75 hover:text-black font-sans-clean text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Open Full Bar Desk View</span>
                </button>
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
        subtitle="enter staff pin to unlock onboarding & terminal controls"
        onSuccess={() => setIsPinModalOpen(false)}
        onClose={() => setIsPinModalOpen(false)}
      />
    </div>
  );
}
