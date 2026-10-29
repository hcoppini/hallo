'use client';

import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Play,
  Pause,
  RotateCcw,
  QrCode,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  PokerSettings,
  loadPokerSettings,
  savePokerSettings,
  DEFAULT_POKER_SETTINGS,
  extractLevelMinutes,
  formatTimer,
  isPokerGameActive,
} from '@/lib/poker-utils';
import { generateQrDataUrl } from '@/lib/qr-utils';

interface PokerWidgetProps {
  onExpandFeed?: () => void;
}

export function PokerWidget({ onExpandFeed }: PokerWidgetProps) {
  const [pokerSettings, setPokerSettings] = useState<PokerSettings>(DEFAULT_POKER_SETTINGS);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Minimal Live Blind Countdown Timer
  const [levelMinutes, setLevelMinutes] = useState(7);
  const [secondsRemaining, setSecondsRemaining] = useState(7 * 60);
  const [currentLevel, setCurrentLevel] = useState(1);

  const isGameActive = isPokerGameActive(pokerSettings.status);

  useEffect(() => {
    const loaded = loadPokerSettings();
    setPokerSettings(loaded);
    const mins = extractLevelMinutes(loaded.blindInterval, 7);
    setLevelMinutes(mins);
    setSecondsRemaining(mins * 60);
  }, []);

  // Ticking countdown effect: ONLY runs when game is actually active
  useEffect(() => {
    if (!isGameActive) return;
    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          // Advance to next level!
          setCurrentLevel(lvl => lvl + 1);
          return levelMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isGameActive, levelMinutes]);

  useEffect(() => {
    let active = true;
    generateQrDataUrl(pokerSettings.qrUrl || DEFAULT_POKER_SETTINGS.qrUrl, {
      width: 260,
      margin: 1,
      color: {
        dark: '#0a0a0a',
        light: '#ffffff',
      },
    }).then(url => {
      if (active) setQrDataUrl(url);
    });
    return () => {
      active = false;
    };
  }, [pokerSettings.qrUrl]);

  const timerProgress = ((levelMinutes * 60 - secondsRemaining) / (levelMinutes * 60)) * 100;

  return (
    <div className="h-full flex flex-col justify-between space-y-4">
      {/* 1. Header with Title & ONE Single Action Button */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <h3 className="font-display text-xl font-bold lowercase text-white tracking-wide">
            {pokerSettings.tableName}
          </h3>
        </div>

        {/* The SINGLE button requested */}
        <a
          href={pokerSettings.qrUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-sans-clean transition-all cursor-pointer hover:border-white/30"
        >
          <span>open live clock</span>
          <ExternalLink className="w-3 h-3 text-white/60" />
        </a>
      </div>

      {/* 2. Main Content Card filling the screen seamlessly */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5">
        {/* Left: Generous, crisp QR Code */}
        <div className="md:col-span-5 flex flex-col items-center justify-center space-y-2">
          <div className="p-2.5 bg-white rounded-2xl shadow-2xl border-2 border-white/20">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Poker Tournament QR"
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl object-contain"
              />
            ) : (
              <div className="w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center bg-stone-100 rounded-xl">
                <QrCode className="w-12 h-12 text-black/40 animate-pulse" />
              </div>
            )}
          </div>
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-white/50">
            scan to join table
          </span>
        </div>

        {/* Right: Live Minimal Poker Timer + Essential Facts */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-3.5 min-w-0">
          {/* Live Minimal Round Timer */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Level {currentLevel} Timer</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextStatus: PokerSettings['status'] = isGameActive ? 'paused' : 'active';
                  const updated: PokerSettings = { ...pokerSettings, status: nextStatus };
                  setPokerSettings(updated);
                  savePokerSettings(updated);
                }}
                className="font-mono text-[10px] text-white/50 hover:text-white transition-colors cursor-pointer"
              >
                {isGameActive ? 'pause' : 'resume / start'}
              </button>
            </div>

            {/* Big Minimal Countdown */}
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white">
                {formatTimer(secondsRemaining)}
              </span>
              <span className="font-mono text-xs text-white/40">
                / {levelMinutes}:00
              </span>
            </div>

            {/* Level Progress Line */}
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-1000 ease-linear shadow-[0_0_8px_#34d399]"
                style={{ width: `${timerProgress}%` }}
              />
            </div>
          </div>

          {/* Essential Facts Grid */}
          <div className="grid grid-cols-2 gap-2 text-left">
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="font-mono text-[9px] uppercase font-bold text-white/40 block">
                Current Blinds
              </span>
              <span className="font-mono text-sm font-bold text-emerald-300 block truncate">
                {pokerSettings.blinds}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="font-mono text-[9px] uppercase font-bold text-white/40 block">
                Structure
              </span>
              <span className="font-mono text-sm font-bold text-white/80 block truncate">
                {pokerSettings.blindInterval}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="font-mono text-[9px] uppercase font-bold text-white/40 block">
                Buy-In / Format
              </span>
              <span className="font-sans-clean text-xs font-semibold text-white/80 block truncate">
                {pokerSettings.buyIn}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10">
              <span className="font-mono text-[9px] uppercase font-bold text-white/40 block">
                Sync Status
              </span>
              <span className="font-mono text-xs font-bold text-emerald-400 block truncate">
                Live & Synced
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Subtle Footer */}
      <div className="flex items-center justify-between text-xs text-white/40 shrink-0 pt-1 border-t border-white/10">
        <span className="font-sans-clean text-[11px]">
          Live poker clock automatically updates with each blind level
        </span>
        {onExpandFeed && (
          <button
            type="button"
            onClick={onExpandFeed}
            className="hover:text-white underline decoration-white/30 text-[11px] cursor-pointer"
          >
            view live arrivals
          </button>
        )}
      </div>
    </div>
  );
}
