'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePartyStore } from '@/lib/store';
import { Guest } from '@/lib/types';
import {
  UserCheck,
  CheckCircle2,
  Lock,
  LogOut,
  ShieldCheck,
  Wifi,
  Copy,
  Check,
  ExternalLink,
  Search,
  Sparkles,
  Car,
  Tag,
  Link2,
  Edit3,
  Radio,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  parseTagId,
  getNextFreeTagId,
  isUniversalOnboardingTag,
  stripUidFromNotes,
} from '@/lib/tag-utils';
import { isWebNfcSupported, nfcController } from '@/lib/nfc';
import { soundSystem } from '@/lib/audio';
import { useStaffAuth, setStaffStationMode } from '@/lib/auth';
import { subscribeToTagRelay, sendTagRelayMessage } from '@/lib/tag-relay';
import { AdminPinModal } from '@/components/AdminPinModal';
import { GuestOnboardingCard } from '@/components/GuestOnboardingCard';
import { calculateEffectiveLimit } from '@/lib/party-engine';

export default function DoorCheckInPage() {
  const router = useRouter();
  const { guests, checkIn, settings } = usePartyStore();
  const { isAuthenticated, logout } = useStaffAuth();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const nextFreeTag = useMemo(() => getNextFreeTagId(guests), [guests]);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [lastAdmittedGuest, setLastAdmittedGuest] = useState<Guest | null>(null);
  const [relayedTagNotice, setRelayedTagNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Clipboard copy feedback states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [isNfcSupported, setIsNfcSupported] = useState(false);
  const [isNfcScanning, setIsNfcScanning] = useState(false);

  const effectiveTargetTag = useMemo(() => {
    if (!selectedTagId || isUniversalOnboardingTag(selectedTagId)) {
      return nextFreeTag;
    }
    return selectedTagId;
  }, [selectedTagId, nextFreeTag]);

  useEffect(() => {
    setIsNfcSupported(isWebNfcSupported());
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
      const params = new URLSearchParams(window.location.search);
      const urlTag = params.get('tag');
      if (urlTag && !isUniversalOnboardingTag(urlTag)) {
        const parsed = parseTagId(urlTag);
        setSelectedTagId(parsed.canonicalTag || decodeURIComponent(urlTag).toUpperCase());
      }
    }
  }, []);

  // Mark this staff phone as being in 'door' station mode so NFC taps check in rather than auto-serving drinks
  useEffect(() => {
    if (isAuthenticated) {
      setStaffStationMode('door');
    }
  }, [isAuthenticated]);

  // Listen for NFC taps relayed from /t/[id] tabs
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = subscribeToTagRelay(msg => {
      if (msg.type === 'PING_STATION') {
        sendTagRelayMessage({
          type: 'STATION_ACK',
          station: 'door',
        });
      } else if (msg.type === 'TAG_TAPPED' && msg.tagId) {
        if (!isUniversalOnboardingTag(msg.tagId)) {
          setSelectedTagId(msg.tagId);
        }
        soundSystem.playApprovedSound();
        setRelayedTagNotice(`Wristband tapped: ${msg.tagId}`);
        setTimeout(() => setRelayedTagNotice(null), 4000);
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  const startPhysicalReader = async () => {
    const ok = await nfcController.startScan((scannedTag, hardwareUid) => {
      const target = scannedTag || hardwareUid || '';
      if (target && !isUniversalOnboardingTag(target)) {
        const parsed = parseTagId(target);
        setSelectedTagId(parsed.canonicalTag || target.toUpperCase());
        soundSystem.playApprovedSound();
        setRelayedTagNotice(`Scanned wristband: ${parsed.canonicalTag || target}`);
        setTimeout(() => setRelayedTagNotice(null), 3500);
      }
    });
    if (ok) setIsNfcScanning(true);
  };

  const admittedGuests = useMemo(
    () =>
      guests
        .filter(g => g.is_entered && g.name)
        .sort(
          (a, b) =>
            new Date(b.entered_at || 0).getTime() - new Date(a.entered_at || 0).getTime()
        ),
    [guests]
  );

  const filteredAdmittedGuests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return admittedGuests.slice(0, 12);
    return admittedGuests.filter(
      g =>
        (g.name || '').toLowerCase().includes(q) ||
        g.tag_id.toLowerCase().includes(q) ||
        (g.notes || '').toLowerCase().includes(q)
    );
  }, [admittedGuests, searchQuery]);

  const driverCount = useMemo(
    () => admittedGuests.filter(g => g.category === 'driver_minor').length,
    [admittedGuests]
  );
  const vipCount = useMemo(
    () => admittedGuests.filter(g => g.category === 'vip').length,
    [admittedGuests]
  );
  const freeSlotsCount = useMemo(
    () => guests.filter(g => !g.is_entered && !g.name).length,
    [guests]
  );

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    soundSystem.playApprovedSound();
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleOnboardingComplete = (admittedGuest: Guest) => {
    confetti({
      particleCount: 55,
      spread: 65,
      origin: { y: 0.7 },
    });

    setLastAdmittedGuest(admittedGuest);
    // Clear manual override so it automatically advances to the next free slot
    setSelectedTagId('');
  };

  if (!isAuthenticated) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center max-w-sm mx-auto text-center">
        <div className="glass-card p-10 border border-black/15 shadow-2xl space-y-5 w-full">
          <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center mx-auto text-black border border-black/10">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <span className="font-mono text-[10px] text-black/40 uppercase tracking-widest block mb-1">
              STAFF SECURITY LOCK
            </span>
            <h2 className="font-display text-3xl font-bold lowercase text-black">
              door reception
            </h2>
          </div>
          <p className="font-sans-clean text-xs text-black/60 leading-relaxed">
            Authorized hosts and door greeters only. Enter the 4-digit staff PIN to unlock guest onboarding.
          </p>

          <button
            type="button"
            onClick={() => setIsPinModalOpen(true)}
            className="btn-premium-primary w-full py-3.5 text-xs gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>unlock door reception</span>
          </button>
        </div>

        <AdminPinModal
          isOpen={isPinModalOpen}
          title="staff authorization"
          subtitle="enter 4-digit staff pin to unlock door check-in"
          onSuccess={() => setIsPinModalOpen(false)}
          onClose={() => setIsPinModalOpen(false)}
        />
      </div>
    );
  }

  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const universalOnboardingUrl = `${origin}/t/{UID}`;
  const currentTargetUrl = `${origin}/t/${effectiveTargetTag}`;

  return (
    <div className="w-full py-4 space-y-5">
      {/* 1. Compact Host Status Header */}
      <div className="p-3 rounded-2xl bg-black text-white text-xs font-sans-clean flex flex-wrap items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold text-[10px] tracking-wider uppercase block leading-tight">
              Door Onboarding Station
            </span>
            <span className="text-[10px] text-emerald-400/90 flex items-center gap-1 font-mono leading-tight">
              <Wifi className="w-2.5 h-2.5" />
              Live Wristband Relay Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isNfcSupported && !isNfcScanning && (
            <button
              type="button"
              onClick={startPhysicalReader}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Radio className="w-3 h-3" />
              <span>Enable Phone NFC Reader</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push('/t/%7BUID%7D')}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Open standalone Universal Onboarding screen (/t/{UID})"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden sm:inline">Universal Link (/t/&#123;UID&#125;)</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Live Relay Notice */}
      {relayedTagNotice && (
        <div className="p-3 rounded-2xl bg-emerald-600 text-white text-xs font-sans-clean font-bold text-center shadow-lg animate-in fade-in duration-150">
          ⚡ {relayedTagNotice}
        </div>
      )}

      {/* 2. Live Door Telemetry KPI Strip */}
      <section className="grid grid-cols-3 gap-2.5">
        <div className="glass-card p-4 border border-black/10">
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans-clean text-[10px] font-bold uppercase tracking-wider text-black/45">
              admitted inside
            </span>
            <UserCheck className="w-3.5 h-3.5 text-black/35" />
          </div>
          <div className="font-display text-3xl sm:text-4xl font-bold text-black leading-none">
            {admittedGuests.length}
            <span className="text-base text-black/35 font-normal">/{guests.length}</span>
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-1 truncate">
            {freeSlotsCount} wristbands free
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSelectedTagId(nextFreeTag)}
          className="glass-card p-4 border border-black/10 hover:border-black/30 text-left transition-all cursor-pointer"
          title="Click to reset target slot to next free wristband"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans-clean text-[10px] font-bold uppercase tracking-wider text-black/45">
              next free slot
            </span>
            <Tag className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="font-mono text-xl sm:text-2xl font-bold text-black leading-none mt-1">
            {nextFreeTag}
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-1.5 truncate">
            auto-selected for check-in
          </span>
        </button>

        <div className="glass-card p-4 border border-black/10">
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans-clean text-[10px] font-bold uppercase tracking-wider text-black/45">
              guest tiers
            </span>
            <Sparkles className="w-3.5 h-3.5 text-black/35" />
          </div>
          <div className="font-display text-3xl sm:text-4xl font-bold text-black leading-none">
            {vipCount}
            <span className="text-sm font-sans-clean font-normal text-black/40 ml-1">vip</span>
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-1 truncate">
            {driverCount} drivers (0-alc)
          </span>
        </div>
      </section>

      {/* 3. Main 2-Column Onboarding & Registry Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Unified 3-Step Onboarding Card */}
        <div className="lg:col-span-7 space-y-4">
          {/* Celebratory Last Admitted Banner with 1-Tap Pass Link & Actions */}
          {lastAdmittedGuest && (
            <div className="p-5 rounded-3xl bg-emerald-600 text-white shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full">
                    ONBOARDED • {lastAdmittedGuest.tag_id}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-white/80">
                  next up: {nextFreeTag}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-2xl font-bold lowercase leading-tight">
                    {lastAdmittedGuest.name}
                  </h3>
                  <p className="font-sans-clean text-xs text-white/90">
                    Pass active at{' '}
                    <strong className="font-mono">/t/{lastAdmittedGuest.tag_id}</strong> •{' '}
                    {lastAdmittedGuest.category === 'vip'
                      ? 'Unlimited VIP'
                      : lastAdmittedGuest.category === 'driver_minor'
                      ? '0 Alcohol (Driver)'
                      : `${calculateEffectiveLimit(lastAdmittedGuest, settings)} drinks limit`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        `${origin}/t/${lastAdmittedGuest.tag_id}`,
                        `last-${lastAdmittedGuest.tag_id}`
                      )
                    }
                    className="py-2 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-sans-clean font-bold text-xs flex items-center gap-1.5 border border-white/25 transition-all cursor-pointer"
                  >
                    {copiedKey === `last-${lastAdmittedGuest.tag_id}` ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy {lastAdmittedGuest.tag_id} Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/t/${encodeURIComponent(lastAdmittedGuest.tag_id)}?onboarded=1`
                      )
                    }
                    className="py-2 px-3 rounded-xl bg-white text-black hover:bg-white/90 font-sans-clean font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Pass</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Unified Guest Onboarding Card */}
          <GuestOnboardingCard
            targetTagId={effectiveTargetTag}
            isUniversalLink={false}
            guests={guests}
            settings={settings}
            onTargetTagChange={newTag => setSelectedTagId(newTag)}
            onCheckIn={checkIn}
            onComplete={handleOnboardingComplete}
          />
        </div>

        {/* Right Column (5 cols): Quick Link Helper + Recently Admitted Feed */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Simplified 1-Tap Wristband Link Helper */}
          <div className="glass-card p-6 border border-black/12 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold lowercase text-black leading-none">
                    wristband link helper
                  </h3>
                  <p className="font-sans-clean text-[11px] text-black/50 lowercase mt-0.5">
                    1-tap links for nfc tools or browser onboarding
                  </p>
                </div>
              </div>
            </div>

            {/* Option A: Universal Onboarding Link (/t/{UID}) */}
            <div className="p-3.5 rounded-2xl bg-black/[0.03] border border-black/8 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-black/55">
                  UNIVERSAL ONBOARDING LINK
                </span>
                <span className="text-[10px] font-sans-clean text-emerald-700 font-semibold">
                  auto-assigns next free ID
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-xl bg-white border border-black/10 font-mono text-xs text-black truncate">
                  /t/&#123;UID&#125;
                </code>
                <button
                  type="button"
                  onClick={() => handleCopyText(universalOnboardingUrl, 'universal')}
                  className="btn-premium py-2 px-3 text-xs gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedKey === 'universal' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>copy /t/&#123;UID&#125;</span>
                    </>
                  )}
                </button>
              </div>
              <p className="font-sans-clean text-[11px] text-black/50 leading-relaxed">
                Opening <span className="font-mono font-semibold">/t/&#123;UID&#125;</span> opens the onboarding screen and turns into{' '}
                <span className="font-mono font-semibold">/t/{effectiveTargetTag}</span> once saved.
              </p>
            </div>

            {/* Option B: Direct Sticker URL for Current Slot (/t/TAG-00X) */}
            <div className="p-3.5 rounded-2xl bg-black/[0.03] border border-black/8 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-black/55">
                  CURRENT SLOT LINK ({effectiveTargetTag})
                </span>
                <span className="text-[10px] font-sans-clean text-black/45">
                  unique per band
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-xl bg-white border border-black/10 font-mono text-xs text-black truncate">
                  /t/{effectiveTargetTag}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopyText(currentTargetUrl, 'slot')}
                  className="btn-premium-primary py-2 px-3 text-xs gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedKey === 'slot' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>copy {effectiveTargetTag}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Admitted Guests Feed & Quick Search */}
          <div className="glass-card p-6 border border-black/12 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-2xl font-bold lowercase text-black leading-none">
                  admitted guests
                </h3>
                <p className="font-sans-clean text-[11px] text-black/50 lowercase mt-0.5">
                  tap any guest to edit, inspect pass, or copy link
                </p>
              </div>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-black/6 text-black/75">
                {admittedGuests.length}
              </span>
            </div>

            {/* Search Filter */}
            {admittedGuests.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-black/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search admitted guest or TAG-00X..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-black/[0.035] border border-black/12 rounded-xl font-sans-clean text-xs text-black placeholder:text-black/35 outline-none focus:bg-white focus:border-black"
                />
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
              {filteredAdmittedGuests.length === 0 ? (
                <div className="text-center py-8 text-xs font-sans-clean text-black/45 lowercase">
                  {admittedGuests.length === 0
                    ? 'no guests admitted yet — onboard your first guest on the left!'
                    : 'no admitted guests match your search'}
                </div>
              ) : (
                filteredAdmittedGuests.map(guest => {
                  const effLimit = calculateEffectiveLimit(guest, settings);
                  const cleanNote = stripUidFromNotes(guest.notes);
                  const isEditingThis = effectiveTargetTag === guest.tag_id;

                  return (
                    <div
                      key={guest.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                        isEditingThis
                          ? 'bg-black text-white border-black shadow-sm'
                          : 'bg-white/85 hover:bg-white border-black/8 text-black'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                              isEditingThis
                                ? 'bg-white/20 text-white'
                                : 'bg-black/6 text-black/75'
                            }`}
                          >
                            {guest.tag_id}
                          </span>
                          <span className="font-sans-clean text-xs font-bold truncate">
                            {guest.name}
                          </span>
                        </div>

                        <div
                          className={`flex flex-wrap items-center gap-2 mt-1 text-[10px] font-sans-clean ${
                            isEditingThis ? 'text-white/70' : 'text-black/50'
                          }`}
                        >
                          <span>
                            {guest.category === 'vip'
                              ? '✨ VIP (∞)'
                              : guest.category === 'driver_minor'
                              ? '🚗 Driver (0 alc)'
                              : `🍺 ${guest.drinks_consumed}/${effLimit} drinks`}
                          </span>
                          {guest.entered_at && (
                            <span>
                              •{' '}
                              {new Date(guest.entered_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}
                            </span>
                          )}
                          {cleanNote && <span className="truncate">• {cleanNote}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(`${origin}/t/${guest.tag_id}`, guest.id)
                          }
                          title={`Copy /t/${guest.tag_id} link`}
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${
                            isEditingThis
                              ? 'hover:bg-white/15 text-white/80'
                              : 'hover:bg-black/5 text-black/55 hover:text-black'
                          }`}
                        >
                          {copiedKey === guest.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedTagId(guest.tag_id)}
                          title="Load guest into onboarding form to edit"
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${
                            isEditingThis
                              ? 'bg-white/20 text-white'
                              : 'hover:bg-black/5 text-black/55 hover:text-black'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/t/${encodeURIComponent(guest.tag_id)}?mode=view`)
                          }
                          title="Open guest pass (/t/TAG-00X)"
                          className={`p-2 rounded-xl transition-colors cursor-pointer ${
                            isEditingThis
                              ? 'hover:bg-white/15 text-white/80'
                              : 'hover:bg-black/5 text-black/55 hover:text-black'
                          }`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
