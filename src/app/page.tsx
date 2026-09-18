'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { GlassWater, DoorOpen, Settings, ShieldCheck, Radio, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import { LuawsHeader } from '@/components/LuawsHeader';
import { usePartyStore } from '@/lib/store';
import { AdminPinModal } from '@/components/AdminPinModal';

export default function HomePage() {
  const { settings, guests, logs, updateSettings } = usePartyStore();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const enteredCount = guests.filter(g => g.is_entered).length;
  const totalDrinksServed = logs.filter(l => !l.is_reverted && l.drink_type !== 'soft').length;
  const atLimitCount = guests.filter(g => {
    const limit = g.custom_drink_limit ?? settings.default_drink_limit;
    return g.category !== 'vip' && g.drinks_consumed >= limit;
  }).length;

  const togglePartyActive = () => {
    setIsPinModalOpen(true);
  };

  const handlePinSuccess = async () => {
    await updateSettings({ is_party_active: !settings.is_party_active });
    setIsPinModalOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <LuawsHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-12 sm:py-16">
        {/* Hero Section matching luaws.pl */}
        <section className="mb-16 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-black/10 bg-black/[0.02] text-[11px] font-sans-clean font-semibold tracking-widest lowercase text-black/60 mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>29th october // birthday celebration</span>
          </div>

          <h1 className="font-display text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight text-black lowercase leading-none mb-6">
            nfc drink regulation.
          </h1>
          <p className="font-sans-clean text-base sm:text-lg text-black/60 max-w-2xl lowercase leading-relaxed">
            engineered for 100 wristbands. one-tap drink logging on the barman’s phone, automatic safety cutoffs, and effortless door check-in.
          </p>
        </section>

        {/* Live Party Telemetry Strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="glass-card p-6 border border-black/10">
            <span className="font-sans-clean text-[11px] uppercase tracking-wider text-black/40 block mb-1">
              guests inside
            </span>
            <div className="font-display text-4xl sm:text-5xl font-bold text-black">
              {enteredCount}
              <span className="text-xl text-black/30 font-normal">/{guests.length}</span>
            </div>
            <span className="text-[11px] font-sans-clean text-black/50 lowercase">
              {Math.round((enteredCount / (guests.length || 1)) * 100)}% checked in
            </span>
          </div>

          <div className="glass-card p-6 border border-black/10">
            <span className="font-sans-clean text-[11px] uppercase tracking-wider text-black/40 block mb-1">
              drinks poured
            </span>
            <div className="font-display text-4xl sm:text-5xl font-bold text-black">
              {totalDrinksServed}
            </div>
            <span className="text-[11px] font-sans-clean text-black/50 lowercase">
              total alcoholic drinks
            </span>
          </div>

          <div className="glass-card p-6 border border-black/10">
            <span className="font-sans-clean text-[11px] uppercase tracking-wider text-black/40 block mb-1">
              default limit
            </span>
            <div className="font-display text-4xl sm:text-5xl font-bold text-black">
              {settings.default_drink_limit}
            </div>
            <span className="text-[11px] font-sans-clean text-black/50 lowercase">
              drinks per person
            </span>
          </div>

          <div className="glass-card p-6 border border-black/10">
            <span className="font-sans-clean text-[11px] uppercase tracking-wider text-black/40 block mb-1">
              at safety limit
            </span>
            <div className={`font-display text-4xl sm:text-5xl font-bold ${
              atLimitCount > 0 ? 'text-red-600' : 'text-black'
            }`}>
              {atLimitCount}
            </div>
            <span className="text-[11px] font-sans-clean text-black/50 lowercase">
              {atLimitCount > 0 ? 'serving cut off' : 'all guests within limit'}
            </span>
          </div>
        </section>

        {/* Quick Launch Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Barman Station Card */}
          <Link
            href="/barman"
            className="glass-card p-8 group relative flex flex-col justify-between hover:-translate-y-1 transition-all border border-black/10 bg-white/80"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-white mb-6 group-hover:scale-105 transition-transform shadow-md">
                <GlassWater className="w-6 h-6" />
              </div>
              <span className="font-sans-clean text-[11px] uppercase tracking-widest text-black/50 font-semibold block mb-1">
                primary operation
              </span>
              <h2 className="font-display text-3xl font-bold text-black lowercase mb-3">
                barman station
              </h2>
              <p className="font-sans-clean text-xs text-black/60 lowercase leading-relaxed mb-6">
                guest taps wristband on phone. screen shows remaining drinks, chimes on approval, and buzzes red when limit is reached.
              </p>
            </div>
            <div className="flex items-center gap-2 font-sans-clean text-xs font-semibold tracking-wider lowercase text-black group-hover:translate-x-1 transition-transform">
              <span>open station</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Door Check-in Card */}
          <Link
            href="/door"
            className="glass-card p-8 group relative flex flex-col justify-between hover:-translate-y-1 transition-all border border-black/10 bg-white/80"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-black mb-6 group-hover:scale-105 transition-transform border border-black/10">
                <DoorOpen className="w-6 h-6" />
              </div>
              <span className="font-sans-clean text-[11px] uppercase tracking-widest text-black/50 font-semibold block mb-1">
                front door greeter
              </span>
              <h2 className="font-display text-3xl font-bold text-black lowercase mb-3">
                door check-in
              </h2>
              <p className="font-sans-clean text-xs text-black/60 lowercase leading-relaxed mb-6">
                tap physical wristband, assign guest’s name, choose standard or driver/minor category, and record entry time.
              </p>
            </div>
            <div className="flex items-center gap-2 font-sans-clean text-xs font-semibold tracking-wider lowercase text-black group-hover:translate-x-1 transition-transform">
              <span>open check-in</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Admin Panel Card */}
          <Link
            href="/admin"
            className="glass-card p-8 group relative flex flex-col justify-between hover:-translate-y-1 transition-all border border-black/10 bg-white/80"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-black mb-6 group-hover:scale-105 transition-transform border border-black/10">
                <Settings className="w-6 h-6" />
              </div>
              <span className="font-sans-clean text-[11px] uppercase tracking-widest text-black/50 font-semibold block mb-1">
                parents & supervisor
              </span>
              <h2 className="font-display text-3xl font-bold text-black lowercase mb-3">
                admin panel
              </h2>
              <p className="font-sans-clean text-xs text-black/60 lowercase leading-relaxed mb-6">
                configure drink limits, manage individual guest rules, program physical nfc stickers, and export party CSV reports.
              </p>
            </div>
            <div className="flex items-center gap-2 font-sans-clean text-xs font-semibold tracking-wider lowercase text-black group-hover:translate-x-1 transition-transform">
              <span>open panel</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </section>

        {/* Emergency Stop Strip */}
        <section className="glass-card p-6 border border-black/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              settings.is_party_active ? 'bg-black/5 text-black' : 'bg-red-100 text-red-700'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display text-xl font-bold text-black lowercase">
                party master control
              </h4>
              <p className="font-sans-clean text-xs text-black/50 lowercase">
                {settings.is_party_active
                  ? 'bar service is currently active across all devices.'
                  : 'bar service is paused. all drink taps will be rejected.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={togglePartyActive}
            className={settings.is_party_active ? 'btn-premium-danger' : 'btn-premium-primary'}
          >
            {settings.is_party_active ? 'pause bar service' : 'resume bar service'}
          </button>
        </section>
      </main>

      {/* Admin PIN confirmation modal */}
      <AdminPinModal
        isOpen={isPinModalOpen}
        title={settings.is_party_active ? 'pause party service' : 'resume party service'}
        subtitle="enter parent pin to change party state"
        onSuccess={handlePinSuccess}
        onClose={() => setIsPinModalOpen(false)}
      />
    </div>
  );
}
