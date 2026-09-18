'use client';

import React, { useState } from 'react';
import { LuawsHeader } from '@/components/LuawsHeader';
import { GuestTable } from '@/components/GuestTable';
import { DrinkHistoryList } from '@/components/DrinkHistoryList';
import { NfcWriterModal } from '@/components/NfcWriterModal';
import { AdminPinModal } from '@/components/AdminPinModal';
import { usePartyStore } from '@/lib/store';
import {
  Sliders,
  Radio,
  Download,
  RotateCcw,
  Shield,
  Save,
  CheckCircle2,
  Users,
  GlassWater,
  AlertOctagon,
  Lock,
} from 'lucide-react';
import { soundSystem } from '@/lib/audio';

export default function AdminPage() {
  const { settings, guests, logs, updateSettings, exportCsv, resetParty } = usePartyStore();

  const [defaultLimit, setDefaultLimit] = useState(settings.default_drink_limit);
  const [partyName, setPartyName] = useState(settings.party_name);
  const [adminPin, setAdminPin] = useState(settings.admin_pin);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isWriterOpen, setIsWriterOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      default_drink_limit: Number(defaultLimit),
      party_name: partyName.trim(),
      admin_pin: adminPin.trim(),
    });
    soundSystem.playApprovedSound();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExport = () => {
    const csvData = exportCsv();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `halloween_party_guests_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    soundSystem.playApprovedSound();
  };

  const handleResetExecute = async () => {
    await resetParty(100);
    setIsResetConfirmOpen(false);
    soundSystem.playApprovedSound();
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <LuawsHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Page Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 pb-6 border-b border-black/10">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-black/50 block">
              parental & supervisory control
            </span>
            <h1 className="font-display text-4xl sm:text-6xl font-bold lowercase text-black">
              administration
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsWriterOpen(true)}
              className="btn-premium gap-2 py-2.5 px-4 text-xs"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>nfc batch writer</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="btn-premium gap-2 py-2.5 px-4 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>export csv</span>
            </button>

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="btn-premium gap-2 py-2.5 px-4 text-xs text-red-600 hover:text-red-700 hover:border-red-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>reset 100 slots</span>
            </button>
          </div>
        </div>

        {/* Global Party Settings Card */}
        <section className="glass-card p-6 sm:p-8 mb-10 border border-black/10">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-black/10">
            <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-black">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold lowercase text-black">
                party rules & limits configuration
              </h2>
              <p className="font-sans-clean text-xs text-black/50 lowercase">
                changes take effect instantly across all connected devices
              </p>
            </div>
          </div>

          {saveSuccess && (
            <div className="p-3.5 mb-6 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-sans-clean flex items-center gap-2 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>settings updated and propagated successfully!</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-2">
                default drink limit per guest
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={defaultLimit}
                  onChange={e => setDefaultLimit(parseInt(e.target.value || '1', 10))}
                  className="w-24 px-4 py-3 bg-black/5 border border-black/15 rounded-xl font-display text-2xl font-bold text-black outline-none focus:border-black text-center"
                />
                <span className="text-xs font-sans-clean text-black/50 lowercase">
                  drinks before automatic cut-off
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-2">
                party display title
              </label>
              <input
                type="text"
                required
                value={partyName}
                onChange={e => setPartyName(e.target.value)}
                className="w-full px-4 py-3 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-sm text-black outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-2">
                security pin (for supervisor override)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={adminPin}
                  onChange={e => setAdminPin(e.target.value)}
                  className="w-28 px-4 py-3 bg-black/5 border border-black/15 rounded-xl font-mono text-center tracking-widest text-lg text-black outline-none focus:border-black"
                />
                <button
                  type="submit"
                  className="btn-premium-primary py-3 px-5 text-xs gap-2 flex-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>apply rules</span>
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Live Monitoring & Guest Directory Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          {/* Guest Management Table */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-3xl font-bold lowercase text-black">
                wristband & guest registry
              </h2>
              <span className="text-xs font-mono text-black/50">
                100 pregenerated tags
              </span>
            </div>
            <GuestTable />
          </div>

          {/* Live Drink Activity Stream */}
          <div className="lg:col-span-4">
            <h2 className="font-display text-3xl font-bold lowercase text-black mb-4">
              party activity
            </h2>
            <DrinkHistoryList />
          </div>
        </div>
      </main>

      {/* NFC Writer Modal */}
      <NfcWriterModal
        isOpen={isWriterOpen}
        onClose={() => setIsWriterOpen(false)}
      />

      {/* Reset Confirmation Modal */}
      <AdminPinModal
        isOpen={isResetConfirmOpen}
        title="confirm complete party reset"
        subtitle="enter parent pin to erase all check-ins and reset 100 wristbands"
        onSuccess={handleResetExecute}
        onClose={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
}
