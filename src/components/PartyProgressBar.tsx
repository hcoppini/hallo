'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Cake,
  GlassWater,
  Flame,
  Moon,
  Music,
} from 'lucide-react';
import {
  PartyProgramSchedule,
  PartyCheckpoint,
  calculatePartyProgress,
  calculateCheckpointPosition,
  getCheckpointStatus,
  findActiveOrNextCheckpoint,
  getCurrentWallClockTime,
} from '@/lib/party-schedule-utils';

interface PartyProgressBarProps {
  schedule: PartyProgramSchedule;
  onOpenSettings?: () => void;
  simulatedTime?: string | null;
  className?: string;
}

export function PartyProgressBar({
  schedule,
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

  const { active, next } = useMemo(
    () => findActiveOrNextCheckpoint(schedule, currentTime),
    [schedule, currentTime]
  );

  const renderIcon = (icon?: PartyCheckpoint['icon']) => {
    switch (icon) {
      case 'cake':
        return <Cake className="w-2.5 h-2.5" />;
      case 'glass':
        return <GlassWater className="w-2.5 h-2.5" />;
      case 'sparkles':
        return <Sparkles className="w-2.5 h-2.5" />;
      case 'flame':
        return <Flame className="w-2.5 h-2.5" />;
      case 'moon':
        return <Moon className="w-2.5 h-2.5" />;
      case 'music':
        return <Music className="w-2.5 h-2.5" />;
      default:
        return <Sparkles className="w-2.5 h-2.5" />;
    }
  };

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      {/* Start Time */}
      <span className="font-mono text-[11px] tracking-wider text-white/40 shrink-0">
        {startTime}
      </span>

      {/* Main Refined Timeline Track */}
      <div className="relative flex-1 min-w-[140px] max-w-[480px] h-1.5 bg-white/10 rounded-full border border-white/10">
        {/* Sleek Champagne Progress Fill */}
        <div
          className="h-full bg-gradient-to-r from-white/30 via-white/70 to-amber-200/90 rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(255,255,255,0.25)]"
          style={{ width: `${progressPct}%` }}
        />

        {/* Minimal NOW Marker pip */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 pointer-events-none transition-all duration-700 ease-out"
          style={{ left: `${progressPct}%` }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] ring-2 ring-white/30" />
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
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group cursor-default z-10"
              style={{ left: `${pos}%` }}
            >
              {/* Pip Node */}
              <div
                className={`transition-all rounded-full flex items-center justify-center ${
                  isCurrent
                    ? 'w-3 h-3 bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.9)] ring-2 ring-amber-200/60 scale-110'
                    : isPast
                    ? 'w-2 h-2 bg-white/50'
                    : 'w-2 h-2 bg-neutral-900 border border-white/25 group-hover:border-white/60'
                }`}
              >
                {isCurrent && (
                  <span className="scale-75 text-neutral-900">
                    {renderIcon(cp.icon)}
                  </span>
                )}
              </div>

              {/* Clean Tooltip on Hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                <div className="px-2.5 py-1 rounded-lg bg-black/95 border border-white/15 shadow-2xl text-center whitespace-nowrap backdrop-blur-md">
                  <span className="font-mono text-[10px] text-amber-200/90 font-semibold block">
                    {cp.time}
                  </span>
                  <span className="font-sans-clean text-xs text-white/90 block">
                    {cp.title}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* End Time */}
      <span className="font-mono text-[11px] tracking-wider text-white/40 shrink-0">
        {endTime}
      </span>

      {/* Low-Key Milestone Indicator */}
      {(active || next) && (
        <div className="hidden lg:flex items-center gap-2 pl-1 shrink-0 text-xs">
          {active ? (
            <div className="flex items-center gap-1.5 text-white/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[10px] tracking-wider uppercase text-white/50">now</span>
              <span className="font-sans-clean font-medium text-white max-w-[180px] truncate">
                {active.title}
              </span>
            </div>
          ) : next ? (
            <div className="flex items-center gap-1.5 text-white/50">
              <span className="font-mono text-[10px] tracking-wider uppercase text-white/35">next ({next.time})</span>
              <span className="font-sans-clean font-normal text-white/70 max-w-[160px] truncate">
                {next.title}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
