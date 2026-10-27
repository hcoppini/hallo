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
} from '@/lib/party-schedule-utils';

interface PartyProgressBarProps {
  schedule: PartyProgramSchedule;
  onOpenSettings: () => void;
  simulatedTime?: string | null;
  className?: string;
}

export function PartyProgressBar({
  schedule,
  onOpenSettings,
  simulatedTime,
  className = '',
}: PartyProgressBarProps) {
  const [currentTime, setCurrentTime] = useState<string>(
    simulatedTime || getCurrentWallClockTime()
  );

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

  const progressPct = useMemo(
    () => calculatePartyProgress(startTime, endTime, currentTime),
    [startTime, endTime, currentTime]
  );

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

  const renderIcon = (icon?: PartyCheckpoint['icon']) => {
    switch (icon) {
      case 'cake':
        return <Cake className="w-2.5 h-2.5 text-amber-300" />;
      case 'glass':
        return <GlassWater className="w-2.5 h-2.5 text-amber-300" />;
      case 'sparkles':
        return <Sparkles className="w-2.5 h-2.5 text-amber-300" />;
      case 'flame':
        return <Flame className="w-2.5 h-2.5 text-amber-300" />;
      case 'moon':
        return <Moon className="w-2.5 h-2.5 text-amber-300" />;
      case 'music':
        return <Music className="w-2.5 h-2.5 text-amber-300" />;
      default:
        return <Sparkles className="w-2.5 h-2.5 text-amber-300" />;
    }
  };

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      {/* Start Time Pill */}
      <span className="font-mono text-xs font-bold text-white/70 shrink-0">
        {startTime}
      </span>

      {/* Main Timeline Bar Container */}
      <div className="relative flex-1 min-w-[180px] max-w-[560px] h-3.5 bg-white/10 rounded-full border border-white/15">
        {/* Glow Progress Fill */}
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_rgba(251,191,36,0.5)]"
          style={{ width: `${progressPct}%` }}
        />

        {/* Pulsing NOW Marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 pointer-events-none transition-all duration-700 ease-out"
          style={{ left: `${progressPct}%` }}
        >
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute h-4 w-4 rounded-full bg-amber-400 opacity-75"></span>
            <div className="w-3 h-3 rounded-full bg-white border-2 border-amber-400 shadow-[0_0_10px_#fbbf24]" />
          </div>
        </div>

        {/* Checkpoint Milestone Nodes */}
        {sortedCheckpoints.map(cp => {
          const pos = calculateCheckpointPosition(startTime, endTime, cp.time);
          const status = getCheckpointStatus(startTime, endTime, currentTime, cp.time);
          const isCurrent = status === 'current';
          const isPast = status === 'past';

          return (
            <div
              key={cp.id}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group cursor-pointer z-10"
              style={{ left: `${pos}%` }}
              onClick={onOpenSettings}
              title={`${cp.time} — ${cp.title} (${status})`}
            >
              {/* Dot Node */}
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                  isCurrent
                    ? 'bg-amber-400 text-black ring-2 ring-amber-400/50 shadow-[0_0_10px_#fbbf24] scale-110'
                    : isPast
                    ? 'bg-neutral-800 border border-amber-400/70 text-amber-400'
                    : 'bg-neutral-900 border border-white/30 text-white/60 group-hover:border-white group-hover:scale-105'
                }`}
              >
                {isPast ? (
                  <span className="text-[8px] font-bold">✓</span>
                ) : (
                  renderIcon(cp.icon)
                )}
              </div>

              {/* Clean Tooltip on Hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                <div className="px-2 py-1 rounded-md bg-black/90 border border-white/20 shadow-xl text-center whitespace-nowrap">
                  <span className="font-mono text-[10px] font-bold text-amber-300 block">
                    {cp.time}
                  </span>
                  <span className="font-sans-clean text-[11px] text-white block">
                    {cp.title}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* End Time Pill */}
      <span className="font-mono text-xs font-bold text-white/70 shrink-0">
        {endTime}
      </span>

      {/* Active or Upcoming Highlight Badge */}
      <div
        onClick={onOpenSettings}
        className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs cursor-pointer transition-colors shrink-0"
        title="Click to view/edit party schedule"
      >
        {active ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono text-[11px] font-bold text-amber-400 uppercase">
              Now:
            </span>
            <span className="font-sans-clean text-xs font-semibold text-white max-w-[130px] truncate">
              {active.title}
            </span>
          </>
        ) : next ? (
          <>
            <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            <span className="font-sans-clean text-xs font-semibold text-white max-w-[130px] truncate">
              {next.title}
            </span>
            <span className="font-mono text-[10px] text-amber-300">
              ({next.time} • {formatMinutesUntil(minutesUntilNext)})
            </span>
          </>
        ) : (
          <span className="font-mono text-[11px] text-white/50">
            {currentTime}
          </span>
        )}
      </div>

      {/* Settings / Edit Button */}
      <button
        type="button"
        onClick={onOpenSettings}
        className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/15 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer shrink-0"
        title="Edit Party Schedule & Checkpoints"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
