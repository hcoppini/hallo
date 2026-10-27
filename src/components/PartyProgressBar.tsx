'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Sparkles,
  Cake,
  GlassWater,
  Flame,
  Moon,
  Music,
  Settings,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  PartyProgramSchedule,
  PartyCheckpoint,
  calculatePartyProgress,
  calculateCheckpointPosition,
  getCheckpointStatus,
  findActiveOrNextCheckpoint,
  formatMinutesUntil,
  getCurrentWallClockTime,
  calculatePartyDurationMinutes,
} from '@/lib/party-schedule-utils';

interface PartyProgressBarProps {
  schedule: PartyProgramSchedule;
  onOpenSettings: () => void;
  simulatedTime?: string | null;
}

export function PartyProgressBar({
  schedule,
  onOpenSettings,
  simulatedTime,
}: PartyProgressBarProps) {
  const [currentTime, setCurrentTime] = useState<string>(
    simulatedTime || getCurrentWallClockTime()
  );

  // Keep live time updated every 5 seconds
  useEffect(() => {
    if (simulatedTime) {
      setCurrentTime(simulatedTime);
      return;
    }
    const update = () => setCurrentTime(getCurrentWallClockTime());
    update();
    const timer = setInterval(update, 5000);
    return () => clearInterval(timer);
  }, [simulatedTime]);

  const { startTime, endTime, checkpoints } = schedule;

  // Calculate party metrics
  const progressPct = useMemo(
    () => calculatePartyProgress(startTime, endTime, currentTime),
    [startTime, endTime, currentTime]
  );

  const durationMinutes = useMemo(
    () => calculatePartyDurationMinutes(startTime, endTime),
    [startTime, endTime]
  );
  const durationHours = (durationMinutes / 60).toFixed(1).replace('.0', '');

  // Sorted checkpoints
  const sortedCheckpoints = useMemo(() => {
    return [...checkpoints].sort((a, b) => {
      const posA = calculateCheckpointPosition(startTime, endTime, a.time);
      const posB = calculateCheckpointPosition(startTime, endTime, b.time);
      return posA - posB;
    });
  }, [checkpoints, startTime, endTime]);

  const { active, next, minutesUntilNext } = useMemo(
    () => findActiveOrNextCheckpoint(schedule, currentTime),
    [schedule, currentTime]
  );

  // Icon renderer helper
  const renderCheckpointIcon = (icon?: PartyCheckpoint['icon'], className = 'w-3.5 h-3.5') => {
    switch (icon) {
      case 'cake':
        return <Cake className={className} />;
      case 'glass':
        return <GlassWater className={className} />;
      case 'sparkles':
        return <Sparkles className={className} />;
      case 'flame':
        return <Flame className={className} />;
      case 'moon':
        return <Moon className={className} />;
      case 'music':
        return <Music className={className} />;
      default:
        return <Sparkles className={className} />;
    }
  };

  return (
    <div className="w-full bg-[#0a0a0a]/95 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md transition-all duration-300">
      {/* 1. Header Information Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Left: Party Schedule Header & Time Range */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xl sm:text-2xl font-bold lowercase tracking-tight leading-none text-white">
                {schedule.title || 'party program'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-white/80 border border-white/10">
                {startTime} — {endTime} ({durationHours}h)
              </span>
            </div>
            <p className="font-sans-clean text-[11px] text-white/50 lowercase mt-0.5">
              custom timeline with live checkpoint tracker
            </p>
          </div>
        </div>

        {/* Center: Active / Upcoming Event Highlight Callout */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10">
          {active ? (
            <div className="flex items-center gap-2 text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
              </span>
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                HAPPENING NOW:
              </span>
              <span className="font-sans-clean text-xs font-bold text-white flex items-center gap-1.5">
                {renderCheckpointIcon(active.icon, 'w-3.5 h-3.5 text-amber-400')}
                {active.title}
              </span>
            </div>
          ) : next ? (
            <div className="flex items-center gap-2 text-white/80">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="font-mono text-xs font-bold text-amber-400/90 uppercase tracking-wider">
                UP NEXT:
              </span>
              <span className="font-sans-clean text-xs font-bold text-white flex items-center gap-1.5">
                {renderCheckpointIcon(next.icon, 'w-3.5 h-3.5 text-amber-400')}
                {next.title} ({next.time})
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                {formatMinutesUntil(minutesUntilNext)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-white/60">
              <Moon className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-sans-clean text-xs lowercase">
                late night party vibes in full swing
              </span>
            </div>
          )}
        </div>

        {/* Right: Live Clock & Customize Button */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-white">
            <span className="font-mono text-xs font-bold text-amber-400">
              {currentTime}
            </span>
            <span className="text-[10px] font-mono text-white/40">
              {progressPct}% elapsed
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-sans-clean font-bold tracking-wider lowercase transition-all cursor-pointer hover:border-amber-400/50"
            title="Customize party start/end times and checkpoint milestones"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">edit schedule</span>
          </button>
        </div>
      </div>

      {/* 2. Main Big Progress Bar Track */}
      <div className="relative pt-6 pb-9 px-3">
        {/* Progress Bar Background Groove */}
        <div className="relative w-full h-4 sm:h-5 rounded-full bg-white/10 border border-white/10 overflow-hidden shadow-inner">
          {/* Animated Glow Fill */}
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 rounded-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(251,191,36,0.5)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Live Current Time Pin / Pulsing Dot Marker */}
        <div
          className="absolute top-4 -translate-x-1/2 transition-all duration-700 ease-out pointer-events-none z-20"
          style={{ left: `calc(${progressPct}% + 12px)` }}
        >
          <div className="flex flex-col items-center">
            {/* Pulsing indicator */}
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute h-6 w-6 rounded-full bg-amber-400 opacity-60"></span>
              <div className="w-4 h-4 rounded-full bg-white border-2 border-amber-400 shadow-[0_0_12px_#fbbf24] z-10" />
            </div>
            {/* Current Time Floating Tag */}
            <span className="mt-1 px-1.5 py-0.5 rounded bg-amber-400 text-black font-mono text-[9px] font-extrabold uppercase shadow-md leading-none">
              NOW {currentTime}
            </span>
          </div>
        </div>

        {/* 3. Milestone Checkpoints along the Bar */}
        <div className="relative w-full mt-[-18px] sm:mt-[-22px]">
          {sortedCheckpoints.map(cp => {
            const pos = calculateCheckpointPosition(startTime, endTime, cp.time);
            const status = getCheckpointStatus(startTime, endTime, currentTime, cp.time);
            const isCurrent = status === 'current';
            const isPast = status === 'past';

            return (
              <div
                key={cp.id}
                className="absolute -translate-x-1/2 flex flex-col items-center transition-all duration-300 group cursor-pointer"
                style={{ left: `${pos}%` }}
                onClick={onOpenSettings}
                title={`${cp.time} — ${cp.title} (${status})`}
              >
                {/* Dot Marker on Track */}
                <div
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCurrent
                      ? 'bg-amber-400 text-black ring-4 ring-amber-400/40 shadow-[0_0_16px_rgba(251,191,36,0.9)] scale-110 z-10'
                      : isPast
                      ? 'bg-neutral-800 border-2 border-amber-400/80 text-amber-400'
                      : 'bg-[#181818] border-2 border-white/30 text-white/70 group-hover:border-white group-hover:scale-105'
                  }`}
                >
                  {isPast ? (
                    <span className="text-[10px] font-bold">✓</span>
                  ) : (
                    renderCheckpointIcon(cp.icon, 'w-2.5 h-2.5 sm:w-3 sm:h-3')
                  )}
                </div>

                {/* Checkpoint Detail Label (Below Bar) */}
                <div className="mt-2 text-center flex flex-col items-center min-w-[70px] max-w-[120px] sm:max-w-[140px]">
                  {/* Time Badge */}
                  <span
                    className={`font-mono text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded transition-colors ${
                      isCurrent
                        ? 'bg-amber-400 text-black font-extrabold'
                        : isPast
                        ? 'text-white/60'
                        : 'text-amber-400/90'
                    }`}
                  >
                    {cp.time}
                  </span>

                  {/* Event Name */}
                  <span
                    className={`font-sans-clean text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2 mt-0.5 transition-colors ${
                      isCurrent
                        ? 'text-amber-300 font-bold'
                        : isPast
                        ? 'text-white/50 line-through decoration-white/20'
                        : 'text-white/90 group-hover:text-white'
                    }`}
                  >
                    {cp.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
