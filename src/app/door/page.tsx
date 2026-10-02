'use client';

import React, { useState, useMemo } from 'react';
import { NfcReader } from '@/components/NfcReader';
import { usePartyStore } from '@/lib/store';
import { GuestCategory } from '@/lib/types';
import { UserCheck, Shield, CheckCircle2, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function DoorCheckInPage() {
  const { guests, checkIn, settings } = usePartyStore();

  const [tagId, setTagId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GuestCategory>('standard');
  const [customLimit, setCustomLimit] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastCheckedIn, setLastCheckedIn] = useState<string | null>(null);

  // Find next unassigned tag for fast 1-click selection
  const nextUnassigned = useMemo(() => {
    return guests.find(g => !g.is_entered && !g.name);
  }, [guests]);

  const checkedInCount = guests.filter(g => g.is_entered).length;
  const recentCheckedIn = guests
    .filter(g => g.is_entered)
    .sort((a, b) => new Date(b.entered_at || 0).getTime() - new Date(a.entered_at || 0).getTime())
    .slice(0, 6);

  const handleTagScanned = (scannedTag: string) => {
    setTagId(scannedTag);
    // Check if this tag is already known
    const existing = guests.find(g => g.tag_id.toUpperCase() === scannedTag.toUpperCase());
    if (existing?.name) {
      setName(existing.name);
      setCategory(existing.category);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!tagId.trim()) {
      setErrorMsg('Please tap or enter a wristband tag ID.');
      return;
    }

    if (!name.trim()) {
      setErrorMsg('Please enter the guest name.');
      return;
    }

    try {
      const checkedGuest = await checkIn({
        tag_id: tagId.trim().toUpperCase(),
        name: name.trim(),
        category,
        custom_drink_limit: customLimit !== '' ? parseInt(customLimit, 10) : null,
        notes: notes.trim() || undefined,
      });

      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.8 },
      });

      setLastCheckedIn(checkedGuest.name || checkedGuest.tag_id);
      setName('');
      setNotes('');
      setCustomLimit('');

      // Auto-populate next available tag
      if (nextUnassigned) {
        setTagId(nextUnassigned.tag_id);
      } else {
        setTagId('');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  return (
    <div className="w-full py-4 space-y-6">
        {/* Page Title & Stats */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-black/50 block">
              front door // reception desk
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-bold lowercase text-black">
              door check-in
            </h1>
          </div>

          <div className="glass-card px-5 py-3 border border-black/10 flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-black" />
            <div>
              <span className="font-display text-xl font-bold text-black leading-none block">
                {checkedInCount} / {guests.length}
              </span>
              <span className="font-sans-clean text-[10px] text-black/50 lowercase">
                guests admitted
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Check-in Form */}
          <div className="lg:col-span-7">
            <div className="glass-card p-6 sm:p-8 border border-black/15 shadow-md">
              <h2 className="font-display text-2xl font-bold lowercase text-black mb-1">
                assign & admit guest
              </h2>
              <p className="font-sans-clean text-xs text-black/60 lowercase mb-6">
                tap wristband sticker to phone or select next bracelet number
              </p>

              {errorMsg && (
                <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-xs font-sans-clean flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {lastCheckedIn && (
                <div className="p-3 mb-6 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-sans-clean flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>admitted: <strong>{lastCheckedIn}</strong>. wristband is active!</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Wristband Tag ID */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-sans-clean font-semibold text-black/70 lowercase">
                      wristband tag id
                    </label>
                    {nextUnassigned && (
                      <button
                        type="button"
                        onClick={() => setTagId(nextUnassigned.tag_id)}
                        className="text-[11px] font-sans-clean text-black/50 hover:text-black underline"
                      >
                        next free: {nextUnassigned.tag_id}
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Tap NFC tag or enter TAG-001..."
                    value={tagId}
                    onChange={e => setTagId(e.target.value)}
                    className="w-full px-4 py-3 bg-black/5 border border-black/15 rounded-xl font-mono text-sm uppercase text-black outline-none focus:border-black transition-colors"
                  />
                </div>

                {/* Guest Name */}
                <div>
                  <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                    guest name / nickname
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Kasia Smagieł"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-sm text-black outline-none focus:border-black transition-colors"
                  />
                </div>

                {/* Guest Category / Tier */}
                <div>
                  <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                    guest category & alcohol rules
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'standard', label: 'standard 18+', sub: `${settings.default_drink_limit} drinks` },
                      { id: 'driver_minor', label: 'driver / minor', sub: '0 alcohol' },
                      { id: 'vip', label: 'vip / host', sub: 'unlimited' },
                    ].map(tier => {
                      const isSelected = category === tier.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setCategory(tier.id as GuestCategory)}
                          className={`p-3 rounded-xl text-left border transition-all ${
                            isSelected
                              ? 'bg-black text-white border-black shadow-sm'
                              : 'bg-white/70 hover:bg-white text-black border-black/10'
                          }`}
                        >
                          <span className="font-sans-clean text-xs font-bold block lowercase">
                            {tier.label}
                          </span>
                          <span className={`text-[10px] lowercase ${
                            isSelected ? 'text-white/60' : 'text-black/50'
                          }`}>
                            {tier.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Custom Limit & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                      custom drink limit (optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      placeholder={`default: ${settings.default_drink_limit}`}
                      value={customLimit}
                      onChange={e => setCustomLimit(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-xs text-black outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                      notes (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Birthday girl's friend"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-xs text-black outline-none focus:border-black"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-premium-primary w-full py-4 text-xs gap-2 mt-4"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>admit guest & link wristband</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: NFC Scanner & Recent Admissions */}
          <div className="lg:col-span-5 space-y-6">
            <NfcReader
              onTagScanned={handleTagScanned}
              activeTagId={tagId}
              modeLabel="scan wristband to register"
            />

            {/* Recent Admissions Feed */}
            <div className="glass-card p-6 border border-black/10">
              <h3 className="font-display text-xl font-bold lowercase text-black mb-3">
                recently admitted
              </h3>
              <div className="space-y-2">
                {recentCheckedIn.length === 0 ? (
                  <div className="text-center py-6 text-xs font-sans-clean text-black/40 lowercase">
                    no guests admitted yet
                  </div>
                ) : (
                  recentCheckedIn.map(guest => (
                    <div
                      key={guest.id}
                      className="p-3 rounded-xl bg-white/80 border border-black/5 flex items-center justify-between text-xs font-sans-clean"
                    >
                      <div>
                        <span className="font-bold text-black block">{guest.name}</span>
                        <span className="text-[10px] text-black/50 font-mono">
                          {guest.tag_id} • {guest.entered_at ? new Date(guest.entered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 text-black/70 lowercase font-semibold">
                        {guest.category}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
