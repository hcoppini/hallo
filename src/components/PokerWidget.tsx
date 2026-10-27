'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  QrCode,
  Settings,
  ExternalLink,
  Shield,
  Layers,
  Clock,
  Coins,
  Check,
  X,
} from 'lucide-react';
import {
  PokerSettings,
  loadPokerSettings,
  savePokerSettings,
  DEFAULT_POKER_SETTINGS,
} from '@/lib/poker-utils';
import { generateQrDataUrl } from '@/lib/qr-utils';

interface PokerWidgetProps {
  onExpandFeed?: () => void;
}

export function PokerWidget({ onExpandFeed }: PokerWidgetProps) {
  const [pokerSettings, setPokerSettings] = useState<PokerSettings>(DEFAULT_POKER_SETTINGS);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<PokerSettings>(DEFAULT_POKER_SETTINGS);

  // Load saved settings on mount
  useEffect(() => {
    const loaded = loadPokerSettings();
    setPokerSettings(loaded);
    setEditForm(loaded);
  }, []);

  // Generate QR Code data URL whenever qrUrl changes
  useEffect(() => {
    let active = true;
    generateQrDataUrl(pokerSettings.qrUrl || 'https://pokernow.club/', {
      width: 260,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    }).then(url => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [pokerSettings.qrUrl]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setPokerSettings(editForm);
    savePokerSettings(editForm);
    setIsEditModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col justify-between space-y-4">
      {/* Top Banner: Status & Edit */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
            {pokerSettings.status === 'active' ? 'TABLE ACTIVE • CARDS IN PLAY' : 'POKER TOURNAMENT'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditForm(pokerSettings);
            setIsEditModalOpen(true);
          }}
          className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          title="Edit Poker Table Settings & QR Link"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Poker Canvas: Big QR Code + Details */}
      <div className="flex flex-col sm:flex-row items-center gap-5 bg-gradient-to-br from-amber-500/10 via-neutral-900/60 to-black p-4 sm:p-5 rounded-2xl border border-amber-400/20 shadow-xl">
        {/* Crisp QR Code Container */}
        <div className="relative p-2.5 bg-white rounded-2xl shadow-2xl shrink-0 group transition-transform hover:scale-[1.02]">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan Poker Table QR Code"
              className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl object-contain"
            />
          ) : (
            <div className="w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center bg-neutral-100 rounded-xl">
              <QrCode className="w-12 h-12 text-black/40 animate-pulse" />
            </div>
          )}
          <div className="absolute inset-x-2 -bottom-2 text-center">
            <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black font-mono text-[9px] font-extrabold uppercase shadow-md">
              SCAN TO JOIN
            </span>
          </div>
        </div>

        {/* Tournament / Table Information */}
        <div className="flex-1 space-y-3 text-center sm:text-left min-w-0">
          <div>
            <h3 className="font-display text-2xl sm:text-3xl font-bold lowercase text-white tracking-tight leading-tight">
              {pokerSettings.tableName}
            </h3>
            <p className="font-sans-clean text-xs text-white/60 lowercase mt-0.5">
              {pokerSettings.notes || 'scan with your phone to view live tournament clock & seat positions'}
            </p>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-left">
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="font-mono text-[9px] uppercase font-bold text-white/50 block">
                Current Blinds
              </span>
              <span className="font-mono text-xs sm:text-sm font-bold text-amber-300">
                {pokerSettings.blinds}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="font-mono text-[9px] uppercase font-bold text-white/50 block">
                Starting Stack
              </span>
              <span className="font-mono text-xs sm:text-sm font-bold text-white">
                {pokerSettings.buyIn}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="font-mono text-[9px] uppercase font-bold text-white/50 block">
                Blind Level Clock
              </span>
              <span className="font-mono text-xs sm:text-sm font-bold text-white">
                {pokerSettings.blindInterval}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="font-mono text-[9px] uppercase font-bold text-white/50 block">
                Platform / App
              </span>
              <a
                href={pokerSettings.qrUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs font-bold text-amber-400 hover:underline flex items-center gap-1 truncate"
              >
                <span>open link</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Helper */}
      <div className="flex items-center justify-between text-[11px] text-white/50 pt-2 border-t border-white/10">
        <span className="font-sans-clean lowercase">
          Point phone camera at QR code to open poker lobby
        </span>
        {onExpandFeed && (
          <button
            type="button"
            onClick={onExpandFeed}
            className="hover:text-white underline decoration-white/30 lowercase cursor-pointer"
          >
            show guest arrivals feed
          </button>
        )}
      </div>

      {/* Edit Poker Table Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161616] border border-white/20 rounded-3xl p-5 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="font-display text-2xl font-bold lowercase">
                customize poker table
              </h4>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                  Table Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.tableName}
                  onChange={e => setEditForm(prev => ({ ...prev, tableName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-sans-clean focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                  QR Code URL / Link (PokerNow, Clock, Room URL)
                </label>
                <input
                  type="text"
                  required
                  value={editForm.qrUrl}
                  onChange={e => setEditForm(prev => ({ ...prev, qrUrl: e.target.value }))}
                  placeholder="https://pokernow.club/..."
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                    Blinds
                  </label>
                  <input
                    type="text"
                    value={editForm.blinds}
                    onChange={e => setEditForm(prev => ({ ...prev, blinds: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                    Buy-In
                  </label>
                  <input
                    type="text"
                    value={editForm.buyIn}
                    onChange={e => setEditForm(prev => ({ ...prev, buyIn: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                  Blind Level Interval
                </label>
                <input
                  type="text"
                  value={editForm.blindInterval}
                  onChange={e =>
                    setEditForm(prev => ({ ...prev, blindInterval: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-sans-clean"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-1.5 rounded-full text-xs font-sans-clean text-white/60 hover:text-white"
                >
                  cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 rounded-full bg-amber-400 text-black font-sans-clean font-bold text-xs hover:bg-amber-300 transition-all cursor-pointer shadow-md"
                >
                  save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
