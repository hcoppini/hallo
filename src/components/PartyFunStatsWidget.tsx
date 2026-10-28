'use client';

import React, { useMemo } from 'react';
import {
  Trophy,
  Crown,
  Medal,
  Award,
  GlassWater,
  Users,
  Heart,
  Flame,
  Sparkles,
  Wine,
} from 'lucide-react';
import { Guest, DrinkLog } from '@/lib/types';
import { parseTagId } from '@/lib/tag-utils';

interface PartyFunStatsWidgetProps {
  guests: Guest[];
  logs?: DrinkLog[];
}

export function PartyFunStatsWidget({ guests }: PartyFunStatsWidgetProps) {
  // 1. Entered guests
  const entered = useMemo(() => guests.filter(g => g.is_entered), [guests]);

  // 2. Top Drinkers (sorted descending)
  const topDrinkers = useMemo(() => {
    return [...entered]
      .filter(g => g.drinks_consumed > 0)
      .sort((a, b) => b.drinks_consumed - a.drinks_consumed)
      .slice(0, 4);
  }, [entered]);

  // 3. Total drinks consumed across all guests
  const totalDrinksConsumed = useMemo(() => {
    return guests.reduce((sum, g) => sum + (g.drinks_consumed || 0), 0);
  }, [guests]);

  // 4. Designated drivers / Non-drinkers
  const soberHeroes = useMemo(() => {
    return entered.filter(g => g.category === 'driver_minor' || g.custom_drink_limit === 0);
  }, [entered]);

  // 5. Turnout percentage
  const totalCapacity = guests.length || 1;
  const turnoutPct = Math.round((entered.length / totalCapacity) * 100);

  // Maximum drinks consumed for proportional visual bar
  const maxDrinks = topDrinkers[0]?.drinks_consumed || 1;

  const renderRankBadge = (rankIndex: number) => {
    switch (rankIndex) {
      case 0:
        return (
          <div className="w-6 h-6 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.2)]">
            <Crown className="w-3.5 h-3.5" />
          </div>
        );
      case 1:
        return (
          <div className="w-6 h-6 rounded-lg bg-slate-300/20 border border-slate-300/40 text-slate-200 flex items-center justify-center shrink-0">
            <Medal className="w-3.5 h-3.5" />
          </div>
        );
      case 2:
        return (
          <div className="w-6 h-6 rounded-lg bg-amber-800/30 border border-amber-700/40 text-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-3.5 h-3.5" />
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-white/60 flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
            #{rankIndex + 1}
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col justify-between space-y-4">
      {/* 1. Sleek Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-300/80" />
          <h3 className="font-display text-xl font-bold lowercase text-white tracking-wide">
            party leaderboard & stats
          </h3>
        </div>
        <span className="font-mono text-xs text-white/40">
          {entered.length} active guests
        </span>
      </div>

      {/* 2. Structured Content Cards */}
      <div className="flex-1 min-h-0 space-y-3.5">
        {/* Leaderboard Card */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/50">
              Top Drink Champions
            </span>
            <Wine className="w-3.5 h-3.5 text-white/40" />
          </div>

          {topDrinkers.length === 0 ? (
            <div className="py-6 text-center space-y-1.5">
              <GlassWater className="w-6 h-6 text-white/20 mx-auto" />
              <p className="text-xs text-white/50 font-sans-clean">
                Bar open — awaiting first orders from guests
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {topDrinkers.map((drinker, idx) => {
                const tag = parseTagId(drinker.tag_id).tagNumber;
                const barWidth = Math.max(12, Math.round((drinker.drinks_consumed / maxDrinks) * 100));

                return (
                  <div
                    key={drinker.id}
                    className={`relative overflow-hidden p-2.5 rounded-xl border transition-all ${
                      idx === 0
                        ? 'bg-amber-400/[0.08] border-amber-400/30 text-amber-200'
                        : 'bg-white/[0.02] border-white/5 text-white'
                    }`}
                  >
                    {/* Visual Progress Bar in Background */}
                    <div
                      className={`absolute inset-y-0 left-0 opacity-15 pointer-events-none ${
                        idx === 0 ? 'bg-amber-400' : 'bg-white'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />

                    <div className="relative flex items-center justify-between gap-3 z-10">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {renderRankBadge(idx)}
                        <span className="font-mono text-xs text-white/40 shrink-0">
                          {tag ? `#${tag.toString().padStart(3, '0')}` : drinker.tag_id}
                        </span>
                        <span className="font-display text-base sm:text-lg font-bold lowercase truncate text-white">
                          {drinker.name || `Guest ${drinker.tag_id}`}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-1.5 shrink-0">
                        <span className="font-mono text-base font-bold text-white">
                          {drinker.drinks_consumed}
                        </span>
                        <span className="font-sans-clean text-[10px] text-white/50 lowercase">
                          drinks
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Venue Highlights Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Total Drinks Poured */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-center flex flex-col justify-center space-y-1">
            <div className="w-7 h-7 rounded-lg bg-amber-400/10 text-amber-300 flex items-center justify-center mx-auto">
              <GlassWater className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-2xl font-bold text-white">
              {totalDrinksConsumed}
            </span>
            <span className="font-sans-clean text-[10px] text-white/50 lowercase">
              drinks poured
            </span>
          </div>

          {/* Turnout Percentage */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-center flex flex-col justify-center space-y-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-400/10 text-emerald-400 flex items-center justify-center mx-auto">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-2xl font-bold text-emerald-400">
              {turnoutPct}%
            </span>
            <span className="font-sans-clean text-[10px] text-white/50 lowercase">
              venue turnout
            </span>
          </div>

          {/* Sober Heroes / Drivers */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-center flex flex-col justify-center space-y-1">
            <div className="w-7 h-7 rounded-lg bg-blue-400/10 text-blue-400 flex items-center justify-center mx-auto">
              <Heart className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-2xl font-bold text-white">
              {soberHeroes.length}
            </span>
            <span className="font-sans-clean text-[10px] text-white/50 lowercase">
              sober drivers
            </span>
          </div>
        </div>
      </div>

      {/* 3. Subtle Footer Milestone */}
      <div className="flex items-center justify-between text-xs text-white/40 shrink-0 pt-1 border-t border-white/10">
        <span className="font-sans-clean text-[11px] flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-300/70" />
          <span>Real-time Bar Station Telemetry</span>
        </span>
        <span className="font-mono text-[11px]">
          {entered.length === totalCapacity && totalCapacity > 0
            ? 'Full House (100%)'
            : `${entered.length} / ${totalCapacity} entered`}
        </span>
      </div>
    </div>
  );
}
