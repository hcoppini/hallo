'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePartyStore } from '@/lib/store';
import { Guest, ImportedGuest } from '@/lib/types';
import {
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Search,
  Edit3,
  X,
  Smartphone,
  Link2,
  Users,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  parseTagId,
  getNextFreeTagId,
  isUniversalOnboardingTag,
  stripUidFromNotes,
  findRegisteredGuestByTag,
} from '@/lib/tag-utils';
import { soundSystem } from '@/lib/audio';
import { useStaffAuth, setStaffStationMode } from '@/lib/auth';
import { subscribeToTagRelay, sendTagRelayMessage } from '@/lib/tag-relay';
import { StationLockScreen } from '@/components/StationLockScreen';
import { GuestOnboardingCard } from '@/components/GuestOnboardingCard';
import { NfcWriterModal } from '@/components/NfcWriterModal';

export default function DoorCheckInPage() {
  const router = useRouter();
  const { guests, checkIn, settings, importedGuests } = usePartyStore();
  const { isAuthenticated } = useStaffAuth();
  const [isBatchEncoderOpen, setIsBatchEncoderOpen] = useState(false);
  const [selectedRosterGuest, setSelectedRosterGuest] = useState<ImportedGuest | null>(null);
  const [rosterSearchQuery, setRosterSearchQuery] = useState('');

  const nextFreeTag = useMemo(() => getNextFreeTagId(guests), [guests]);
  const [selectedTagId, setSelectedTagId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTag = params.get('tag');
      if (urlTag && !isUniversalOnboardingTag(urlTag)) {
        const parsed = parseTagId(urlTag);
        return parsed.canonicalTag || decodeURIComponent(urlTag).toUpperCase();
      }
    }
    return '';
  });
  const [lastAdmittedGuest, setLastAdmittedGuest] = useState<Guest | null>(null);
  const [relayedTagNotice, setRelayedTagNotice] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTag = params.get('tag');
      const isUnregistered = params.get('unregistered') === '1';
      if (urlTag) {
        const parsed = parseTagId(urlTag);
        const slotText = parsed.tagNumber !== null ? `#${parsed.tagNumber}` : parsed.canonicalTag;
        return isUnregistered
          ? `⚡ Wristband ${slotText} is unregistered — enter guest name to create new guest!`
          : `Wristband ${slotText} selected for check-in`;
      }
    }
    return null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const effectiveTargetTag = useMemo(() => {
    if (!selectedTagId || isUniversalOnboardingTag(selectedTagId)) {
      return nextFreeTag;
    }
    return selectedTagId;
  }, [selectedTagId, nextFreeTag]);

  // Sync selected tag if URL query parameters change (e.g. redirected from /barman or global NFC tap)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const urlTag = params.get('tag');
      const isUnreg = params.get('unregistered') === '1';
      if (urlTag && !isUniversalOnboardingTag(urlTag)) {
        const parsed = parseTagId(urlTag);
        const canonical = parsed.canonicalTag || decodeURIComponent(urlTag).toUpperCase();
        setSelectedTagId(canonical);
        const slotText = parsed.tagNumber !== null ? `#${parsed.tagNumber}` : canonical;
        setRelayedTagNotice(
          isUnreg
            ? `⚡ Wristband ${slotText} is unregistered — enter guest name to create new guest!`
            : `Wristband ${slotText} selected for check-in`
        );
      }
    };
    syncFromUrl();
  }, []);

  // Mark staff phone in 'door' station mode
  useEffect(() => {
    if (isAuthenticated) {
      setStaffStationMode('door');
    }
  }, [isAuthenticated]);

  // Listen for NFC taps relayed from /t/[id] tabs or local ACR122U bridge
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = subscribeToTagRelay(msg => {
      if (msg.type === 'PING_STATION') {
        sendTagRelayMessage({
          type: 'STATION_ACK',
          station: 'door',
        });
      } else if (msg.type === 'TAG_TAPPED' && (msg.tagId || msg.rawId)) {
        const rawTag = msg.tagId || msg.rawId || '';
        if (isUniversalOnboardingTag(rawTag)) return;

        const parsed = parseTagId(rawTag);
        const canonical = parsed.canonicalTag || rawTag.toUpperCase();
        const slotText = parsed.tagNumber !== null ? `#${parsed.tagNumber}` : canonical;

        const registered = findRegisteredGuestByTag(guests, canonical);
        if (registered) {
          soundSystem.playApprovedSound();
          setLastAdmittedGuest(registered);
          setRelayedTagNotice(`Wristband ${slotText} is already registered to ${registered.name}!`);
          setTimeout(() => setRelayedTagNotice(null), 5000);
        } else {
          setSelectedTagId(canonical);
          soundSystem.playApprovedSound();
          setRelayedTagNotice(`⚡ Wristband ${slotText} tapped — enter guest name to create new guest!`);
          setTimeout(() => setRelayedTagNotice(null), 6000);
        }
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, guests]);

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
    if (!q) return admittedGuests;
    return admittedGuests.filter(
      g =>
        (g.name || '').toLowerCase().includes(q) ||
        g.tag_id.toLowerCase().includes(q) ||
        (g.notes || '').toLowerCase().includes(q)
    );
  }, [admittedGuests, searchQuery]);

  const pendingExpectedGuests = useMemo(() => {
    return (importedGuests || []).filter(g => !g.is_checked_in);
  }, [importedGuests]);

  const filteredPendingExpectedGuests = useMemo(() => {
    const q = rosterSearchQuery.trim().toLowerCase();
    if (!q) return pendingExpectedGuests;
    return pendingExpectedGuests.filter(
      g => g.name.toLowerCase().includes(q) || (g.notes || '').toLowerCase().includes(q)
    );
  }, [pendingExpectedGuests, rosterSearchQuery]);

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    soundSystem.playApprovedSound();
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleOnboardingComplete = (admittedGuest: Guest) => {
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.65 },
    });

    setLastAdmittedGuest(admittedGuest);
    setSelectedTagId('');
    setSelectedRosterGuest(null);
  };

  if (!isAuthenticated) {
    return (
      <StationLockScreen
        stationTitle="door check-in"
        stationSubtitle="enter 4-digit staff pin to unlock door reception desk"
        stationBadge="DOOR RECEPTION DESK"
      />
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const lastAdmittedSlotNum = lastAdmittedGuest
    ? parseTagId(lastAdmittedGuest.tag_id).tagNumber ?? lastAdmittedGuest.tag_id
    : null;

  return (
    <div className="w-full py-2 sm:py-3 lg:py-4 space-y-3 sm:space-y-4 animate-in fade-in duration-150">
      {/* Live Relay Notice */}
      {relayedTagNotice && (
        <div className="p-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-sans-clean font-bold text-center shadow-lg animate-in fade-in duration-150">
          ⚡ {relayedTagNotice}
        </div>
      )}

      {/* Slim Non-Disruptive Check-In Confirmation Toast */}
      {lastAdmittedGuest && (
        <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-lg flex items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span className="font-sans-clean text-xs font-bold truncate">
              {lastAdmittedGuest.name} registered
            </span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/20 uppercase font-bold shrink-0">
              {lastAdmittedGuest.category === 'vip'
                ? 'VIP'
                : lastAdmittedGuest.category === 'driver_minor'
                ? 'Driver'
                : 'Standard'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                handleCopyText(
                  `${origin}/t/${lastAdmittedSlotNum}`,
                  `last-${lastAdmittedGuest.tag_id}`
                )
              }
              className="py-1 px-2.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-sans-clean font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
              title="Copy guest pass link"
            >
              {copiedKey === `last-${lastAdmittedGuest.tag_id}` ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Pass Link</span>
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/t/${encodeURIComponent(lastAdmittedGuest.tag_id)}?onboarded=1`
                )
              }
              className="py-1 px-2.5 rounded-lg bg-white text-black hover:bg-white/90 font-sans-clean font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open</span>
            </button>
            <button
              type="button"
              onClick={() => setLastAdmittedGuest(null)}
              className="p-1 rounded-lg text-white/70 hover:text-white cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Responsive Layout: Check-In Console + Admitted Guests Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 items-start">
        {/* Left Column (6 cols): Streamlined Registration Console + Expected Guests Directory */}
        <div className="lg:col-span-6 space-y-3 sm:space-y-4">
          <GuestOnboardingCard
            targetTagId={effectiveTargetTag}
            isUniversalLink={false}
            guests={guests}
            settings={settings}
            onTargetTagChange={newTag => setSelectedTagId(newTag)}
            onCheckIn={checkIn}
            onComplete={handleOnboardingComplete}
            selectedRosterGuest={selectedRosterGuest}
          />

          {/* Expected Guests Roster Card (Balances the page and eliminates empty void!) */}
          {importedGuests.length > 0 && (
            <div className="glass-card p-4 sm:p-5 border border-black/12 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-black/60" />
                  <h3 className="font-display text-xl font-bold lowercase text-black leading-none">
                    expected guests
                  </h3>
                </div>
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  {pendingExpectedGuests.length} awaiting arrival
                </span>
              </div>

              {/* Simple Search Filter for Expected Guests */}
              {pendingExpectedGuests.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-black/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search expected guests..."
                    value={rosterSearchQuery}
                    onChange={e => setRosterSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-2 bg-black/[0.035] border border-black/12 rounded-xl font-sans-clean text-xs text-black placeholder:text-black/35 outline-none focus:bg-white focus:border-black transition-colors"
                  />
                  {rosterSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setRosterSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-black/40 hover:text-black cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Expected List */}
              <div className="space-y-1.5 max-h-72 sm:max-h-80 lg:max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
                {filteredPendingExpectedGuests.length === 0 ? (
                  <div className="text-center py-8 text-xs font-sans-clean text-black/45 lowercase">
                    {pendingExpectedGuests.length === 0
                      ? '🎉 all expected guests have arrived!'
                      : 'no expected guests match the search'}
                  </div>
                ) : (
                  filteredPendingExpectedGuests.map(guest => {
                    const isSelected = selectedRosterGuest?.id === guest.id;
                    return (
                      <div
                        key={guest.id}
                        onClick={() => {
                          soundSystem.vibrate(10);
                          setSelectedRosterGuest(guest);
                        }}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-black text-white border-black shadow-xs'
                            : 'bg-white hover:bg-black/[0.02] border-black/8 text-black'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-sans-clean text-xs font-bold truncate">
                              {guest.name}
                            </span>
                            <span
                              className={`font-mono text-[9px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                                guest.category === 'vip'
                                  ? 'bg-amber-100 text-amber-800'
                                  : guest.category === 'driver_minor'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-black/6 text-black/60'
                              }`}
                            >
                              {guest.category === 'vip'
                                ? 'VIP'
                                : guest.category === 'driver_minor'
                                ? 'Driver'
                                : 'Standard'}
                            </span>
                          </div>
                          {guest.notes && (
                            <p
                              className={`text-[10px] font-sans-clean truncate mt-0.5 ${
                                isSelected ? 'text-white/70' : 'text-black/50'
                              }`}
                            >
                              {guest.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`py-1 px-2.5 rounded-lg text-xs font-sans-clean font-semibold flex items-center gap-1 transition-all ${
                              isSelected
                                ? 'bg-white text-black font-bold'
                                : 'bg-black/5 text-black/75'
                            }`}
                          >
                            <span>{isSelected ? 'ready' : 'select'}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (6 cols): Admitted Guests Registry (No categories/tags clutter) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="glass-card p-4 sm:p-5 border border-black/12 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl font-bold lowercase text-black leading-none">
                  admitted guests
                </h3>
              </div>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-black/6 text-black/75">
                {admittedGuests.length} admitted
              </span>
            </div>

            {/* Simple Search Filter */}
            {admittedGuests.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-black/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter admitted guests..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 bg-black/[0.035] border border-black/12 rounded-xl font-sans-clean text-xs text-black placeholder:text-black/35 outline-none focus:bg-white focus:border-black transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-black/40 hover:text-black cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Admitted List */}
            <div className="space-y-1.5 max-h-72 sm:max-h-80 lg:max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
              {filteredAdmittedGuests.length === 0 ? (
                <div className="text-center py-8 text-xs font-sans-clean text-black/45 lowercase">
                  {admittedGuests.length === 0
                    ? 'no guests admitted yet — register your first guest on the left!'
                    : 'no admitted guests match the search'}
                </div>
              ) : (
                filteredAdmittedGuests.map(guest => {
                  const cleanNote = stripUidFromNotes(guest.notes);
                  const isEditingThis = effectiveTargetTag === guest.tag_id;

                  return (
                    <div
                      key={guest.id}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                        isEditingThis
                          ? 'bg-black text-white border-black shadow-xs'
                          : 'bg-white hover:bg-black/[0.02] border-black/8 text-black'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-sans-clean text-xs font-bold truncate">
                            {guest.name}
                          </span>
                          <span
                            className={`font-mono text-[9px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                              guest.category === 'vip'
                                ? 'bg-amber-100 text-amber-800'
                                : guest.category === 'driver_minor'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-black/6 text-black/60'
                            }`}
                          >
                            {guest.category === 'vip'
                              ? 'VIP'
                              : guest.category === 'driver_minor'
                              ? 'Driver'
                              : 'Standard'}
                          </span>
                        </div>
                        {cleanNote && (
                          <p
                            className={`text-[10px] font-sans-clean truncate mt-0.5 ${
                              isEditingThis ? 'text-white/70' : 'text-black/50'
                            }`}
                          >
                            {cleanNote}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedTagId(guest.tag_id)}
                          className={`p-1 rounded-lg transition-colors cursor-pointer ${
                            isEditingThis
                              ? 'text-white hover:bg-white/20'
                              : 'text-black/45 hover:text-black hover:bg-black/5'
                          }`}
                          title="Edit guest profile"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Backup NFC Encoder link */}
          <div className="text-right pr-1">
            <button
              type="button"
              onClick={() => setIsBatchEncoderOpen(true)}
              className="text-[11px] font-sans-clean text-black/40 hover:text-black transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <Smartphone className="w-3 h-3" />
              <span>batch nfc encoder</span>
            </button>
          </div>
        </div>
      </div>

      {/* Batch Encoder Modal (Optional backup tool) */}
      <NfcWriterModal
        isOpen={isBatchEncoderOpen}
        onClose={() => setIsBatchEncoderOpen(false)}
        initialTagNumber={1}
      />
    </div>
  );
}
