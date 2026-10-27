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

  useEffect(() => {
    const loaded = loadPokerSettings();
    setPokerSettings(loaded);
    setEditForm(loaded);
  }, []);

  useEffect(() => {
    let active = true;
    generateQrDataUrl(pokerSettings.qrUrl || DEFAULT_POKER_SETTINGS.qrUrl, {
      width: 280,
      margin: 1,
      color: {
        dark: '#060e0a',
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
    <div className="flex-1 flex flex-col justify-between space-y-3.5">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
            {pokerSettings.tableName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={pokerSettings.qrUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-white/10 text-white text-xs font-sans-clean transition-colors"
          >
            <span>open app</span>
            <ExternalLink className="w-3 h-3 text-white/60" />
          </a>

          <button
            type="button"
            onClick={() => {
              setEditForm(pokerSettings);
              setIsEditModalOpen(true);
            }}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Edit Poker Link / Blinds"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Poker Card: QR + Details */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-br from-emerald-950/40 via-neutral-900/60 to-black p-4 rounded-2xl border border-emerald-500/30 shadow-xl">
        {/* Dedicated QR Code */}
        <div className="relative p-2.5 bg-white rounded-2xl shadow-2xl shrink-0 border-2 border-emerald-400/40">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan Piker Tournament QR"
              className="w-32 h-32 sm:w-36 sm:h-36 rounded-xl object-contain"
            />
          ) : (
            <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center bg-stone-100 rounded-xl">
              <QrCode className="w-10 h-10 text-black/40 animate-pulse" />
            </div>
          )}
          <div className="absolute inset-x-2 -bottom-2 text-center">
            <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-black font-mono text-[9px] font-extrabold uppercase shadow-md">
              SCAN TO JOIN
            </span>
          </div>
        </div>

        {/* Tournament Information */}
        <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
          <div>
            <h4 className="font-display text-2xl font-bold lowercase text-white tracking-tight leading-tight">
              tournament table
            </h4>
            <p className="font-sans-clean text-xs text-white/70 mt-0.5">
              11-level rapid heats with 30–40 min turnover
            </p>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-left">
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="font-mono text-[9px] uppercase font-bold text-white/50 block">
                Blinds
              </span>
              <span className="font-mono text-xs font-bold text-emerald-300 truncate block">
                {pokerSettings.blinds}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="font-mono text-[9px] uppercase font-bold text-white/50 block">
                Level Timer
              </span>
              <span className="font-mono text-xs font-bold text-white truncate block">
                {pokerSettings.blindInterval}
              </span>
            </div>
          </div>

          <p className="font-mono text-[10px] text-emerald-400/80 truncate">
            {pokerSettings.qrUrl.replace(/^https?:\/\//, '')}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-white/50 pt-1 border-t border-white/10">
        <span className="font-sans-clean">
          Scan QR with phone to enter table & view live clock
        </span>
        {onExpandFeed && (
          <button
            type="button"
            onClick={onExpandFeed}
            className="hover:text-white underline decoration-white/30 cursor-pointer"
          >
            show guest feed
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
                  Piker Vercel URL
                </label>
                <input
                  type="text"
                  required
                  value={editForm.qrUrl}
                  onChange={e => setEditForm(prev => ({ ...prev, qrUrl: e.target.value }))}
                  placeholder="https://piker-toicupinis-projects.vercel.app"
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
                    Blind Interval
                  </label>
                  <input
                    type="text"
                    value={editForm.blindInterval}
                    onChange={e =>
                      setEditForm(prev => ({ ...prev, blindInterval: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-mono"
                  />
                </div>
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
