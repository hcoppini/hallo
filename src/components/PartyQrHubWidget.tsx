'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  QrCode,
  Music,
  Camera,
  Wifi,
  ExternalLink,
  Spade,
  Clock,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import {
  PartyCustomQr,
  loadPartyQrs,
  loadPokerSettings,
  savePokerSettings,
  PokerSettings,
  DEFAULT_PARTY_QRS,
  PARTY_QRS_STORAGE_KEY,
  POKER_STORAGE_KEY,
  extractLevelMinutes,
  formatTimer,
  isPokerScheduledNow,
  isPokerGameActive,
} from '@/lib/poker-utils';
import { PartyProgramSchedule } from '@/lib/party-schedule-utils';
import { generateQrDataUrl } from '@/lib/qr-utils';

export interface PartyQrHubWidgetProps {
  onExpandFeed?: () => void;
  schedule?: PartyProgramSchedule;
}

export function PartyQrHubWidget({ onExpandFeed, schedule }: PartyQrHubWidgetProps = {}) {
  const [qrs, setQrs] = useState<PartyCustomQr[]>(() => loadPartyQrs());
  const [pokerSettings, setPokerSettings] = useState<PokerSettings>(() => loadPokerSettings());
  const [activeQrIndex, setActiveQrIndex] = useState(0);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});

  // Poker Blind Countdown Timer State
  const initialMins = extractLevelMinutes(pokerSettings.blindInterval, 7);
  const [levelMinutes, setLevelMinutes] = useState(initialMins);
  const [secondsRemaining, setSecondsRemaining] = useState(initialMins * 60);
  const [currentLevel, setCurrentLevel] = useState(1);

  // Auto-sync storage across tabs
  useEffect(() => {
    const sync = () => {
      setQrs(loadPartyQrs());
      const loaded = loadPokerSettings();
      setPokerSettings(loaded);
      const mins = extractLevelMinutes(loaded.blindInterval, 7);
      setLevelMinutes(mins);
    };
    sync();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === PARTY_QRS_STORAGE_KEY || e.key === POKER_STORAGE_KEY) {
        sync();
      }
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(sync, 4000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  // Determine if poker tournament is currently active
  const isScheduledNow = useMemo(() => isPokerScheduledNow(schedule), [schedule]);
  const isGameActive = useMemo(
    () => isPokerGameActive(pokerSettings.status, isScheduledNow),
    [pokerSettings.status, isScheduledNow]
  );

  // Countdown effect: ONLY runs when isGameActive is true!
  useEffect(() => {
    if (!isGameActive) return;

    const interval = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          setCurrentLevel(lvl => lvl + 1);
          return levelMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isGameActive, levelMinutes]);

  const activeQr = qrs[activeQrIndex] || qrs[0] || DEFAULT_PARTY_QRS[0];
  const isPokerQr = activeQr?.icon === 'poker' || activeQr?.id === 'poker-main';

  useEffect(() => {
    if (!activeQr?.url) return;
    let active = true;
    generateQrDataUrl(activeQr.url, {
      width: 260,
      margin: 1,
      color: { dark: '#0a0a0a', light: '#ffffff' },
    }).then(dataUrl => {
      if (active) {
        setQrImages(prev => ({ ...prev, [activeQr.id]: dataUrl }));
      }
    });
    return () => {
      active = false;
    };
  }, [activeQr?.id, activeQr?.url]);

  const handleToggleGameStatus = () => {
    const nextStatus: PokerSettings['status'] = isGameActive ? 'paused' : 'active';
    const updated: PokerSettings = {
      ...pokerSettings,
      status: nextStatus,
    };
    setPokerSettings(updated);
    savePokerSettings(updated);
  };

  const handleResetGame = () => {
    setCurrentLevel(1);
    const mins = extractLevelMinutes(pokerSettings.blindInterval, 7);
    setLevelMinutes(mins);
    setSecondsRemaining(mins * 60);
    const updated: PokerSettings = {
      ...pokerSettings,
      status: 'upcoming',
    };
    setPokerSettings(updated);
    savePokerSettings(updated);
  };

  const totalLevelSeconds = levelMinutes * 60;
  const timerProgress = totalLevelSeconds > 0
    ? ((totalLevelSeconds - secondsRemaining) / totalLevelSeconds) * 100
    : 0;

  const renderIcon = (icon: PartyCustomQr['icon']) => {
    switch (icon) {
      case 'poker':
        return <Spade className="w-4 h-4 text-amber-400 fill-amber-400/20" />;
      case 'music':
        return <Music className="w-4 h-4 text-amber-400" />;
      case 'camera':
        return <Camera className="w-4 h-4 text-emerald-400" />;
      case 'wifi':
        return <Wifi className="w-4 h-4 text-blue-400" />;
      default:
        return <QrCode className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col justify-between space-y-3.5">
      {/* 1. Selector Tabs Ribbon */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 pb-1">
        {qrs.map((item, idx) => {
          const isSelected = activeQrIndex === idx;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveQrIndex(idx)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-sans-clean flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-sm'
                  : 'bg-white/[0.04] border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {renderIcon(item.icon)}
              <span>{item.title}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Main Content Card filling the view */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5">
        {/* Left: QR Code */}
        <div className="md:col-span-5 flex flex-col items-center justify-center space-y-2">
          <div className="p-2.5 bg-white rounded-2xl shadow-2xl border-2 border-white/20">
            {qrImages[activeQr.id] ? (
              <img
                src={qrImages[activeQr.id]}
                alt={activeQr.title}
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl object-contain"
              />
            ) : (
              <div className="w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center bg-neutral-100 rounded-xl">
                <QrCode className="w-12 h-12 text-black/40 animate-pulse" />
              </div>
            )}
          </div>
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-white/50">
            scan with camera
          </span>
        </div>

        {/* Right: Info, Actions & Metadata */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-3 min-w-0">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isGameActive
                    ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]'
                    : pokerSettings.status === 'paused'
                    ? 'bg-amber-400'
                    : 'bg-white/30'
                }`}
              />
              <span className="font-mono text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                {isPokerQr ? 'Live Poker Tournament' : 'Scannable Party QR'}
              </span>
            </div>

            <h3 className="font-display text-xl sm:text-2xl font-bold lowercase text-white tracking-wide truncate">
              {activeQr.title}
            </h3>

            <p className="font-sans-clean text-xs text-white/60 lowercase leading-relaxed line-clamp-2">
              {activeQr.subtitle}
            </p>
          </div>

          {/* If Poker QR, show live countdown timer + blinds metadata */}
          {isPokerQr && (
            <div className="space-y-2.5">
              {/* Live Minimal Round Timer: Works ONLY when game is actually active */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className={`w-3.5 h-3.5 ${isGameActive ? 'text-emerald-400' : 'text-white/40'}`} />
                    <span className={isGameActive ? 'text-emerald-400' : 'text-white/70'}>
                      Level {currentLevel} Timer
                    </span>
                    <span
                      className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase ${
                        isGameActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : pokerSettings.status === 'paused'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-white/10 text-white/50 border border-white/10'
                      }`}
                    >
                      {isGameActive ? 'active' : pokerSettings.status === 'paused' ? 'paused' : 'upcoming'}
                    </span>
                  </span>

                  {/* Status Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleGameStatus}
                      className="font-mono text-[10px] text-white/70 hover:text-white underline decoration-white/30 cursor-pointer"
                    >
                      {isGameActive ? 'pause' : pokerSettings.status === 'paused' ? 'resume' : 'start game'}
                    </button>
                    {(currentLevel > 1 || pokerSettings.status !== 'upcoming') && (
                      <button
                        type="button"
                        onClick={handleResetGame}
                        className="font-mono text-[10px] text-white/40 hover:text-white cursor-pointer"
                        title="Reset tournament back to Level 1"
                      >
                        reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Big Minimal Countdown */}
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {formatTimer(secondsRemaining)}
                  </span>
                  <span className="font-mono text-xs text-white/40">
                    / {levelMinutes}:00
                  </span>
                </div>

                {/* Level Progress Line */}
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ease-linear shadow-[0_0_8px_#34d399] ${
                      isGameActive ? 'bg-emerald-400' : 'bg-white/20'
                    }`}
                    style={{ width: `${timerProgress}%` }}
                  />
                </div>
              </div>

              {/* Tournament Facts */}
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
                  <span className="font-mono text-[9px] uppercase font-bold text-white/40 block">
                    Blinds
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-300 block truncate">
                    {pokerSettings.blinds}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10">
                  <span className="font-mono text-[9px] uppercase font-bold text-white/40 block">
                    Structure
                  </span>
                  <span className="font-mono text-xs font-bold text-white/80 block truncate">
                    {pokerSettings.blindInterval}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <div>
            <a
              href={activeQr.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-sans-clean transition-all cursor-pointer hover:border-white/30"
            >
              <span>{isPokerQr ? 'open live clock' : 'open destination link'}</span>
              <ExternalLink className="w-3.5 h-3.5 text-white/70" />
            </a>
          </div>
        </div>
      </div>

      {/* 3. Footer Bar */}
      <div className="flex items-center justify-between text-xs text-white/40 shrink-0 pt-1 border-t border-white/10">
        <span className="font-sans-clean text-[11px]">
          Point your phone camera to open on mobile
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
