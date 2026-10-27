'use client';

import React, { useState } from 'react';
import {
  X,
  Clock,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Cake,
  GlassWater,
  Flame,
  Moon,
  Music,
  Check,
  PlayCircle,
} from 'lucide-react';
import {
  PartyProgramSchedule,
  PartyCheckpoint,
  DEFAULT_PARTY_SCHEDULE,
  calculatePartyDurationMinutes,
  timeStringToMinutes,
  minutesToTimeString,
} from '@/lib/party-schedule-utils';

interface PartyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: PartyProgramSchedule;
  onSave: (updated: PartyProgramSchedule) => void;
  simulatedTime: string | null;
  onSetSimulatedTime: (time: string | null) => void;
}

const PRESET_PROGRAMS: { name: string; schedule: PartyProgramSchedule }[] = [
  {
    name: 'Birthday Party (20:00 - 02:00)',
    schedule: DEFAULT_PARTY_SCHEDULE,
  },
  {
    name: 'All-Night Rave (21:00 - 05:00)',
    schedule: {
      startTime: '21:00',
      endTime: '05:00',
      title: 'All-Night Party Program',
      checkpoints: [
        { id: 'an-1', time: '21:00', title: 'Doors Open & Warm-up', icon: 'glass' },
        { id: 'an-2', time: '23:00', title: 'DJ Peak Set & Dance Off', icon: 'music' },
        { id: 'an-3', time: '00:00', title: 'Singing HBD & Toast 🎉', icon: 'cake' },
        { id: 'an-4', time: '01:30', title: 'Poker High-Rollers Table', icon: 'sparkles' },
        { id: 'an-5', time: '03:00', title: 'Late Night Pizza & Fuel', icon: 'flame' },
        { id: 'an-6', time: '05:00', title: 'Sunrise Chill & Wrap-up', icon: 'moon' },
      ],
    },
  },
  {
    name: 'Evening Special (19:00 - 01:00)',
    schedule: {
      startTime: '19:00',
      endTime: '01:00',
      title: 'Evening Celebration Program',
      checkpoints: [
        { id: 'es-1', time: '19:00', title: 'Guest Arrivals & Aperitif', icon: 'glass' },
        { id: 'es-2', time: '20:30', title: 'Dinner & Games', icon: 'sparkles' },
        { id: 'es-3', time: '22:00', title: 'Singing HBD & Cake Cutting 🎂', icon: 'cake' },
        { id: 'es-4', time: '23:30', title: 'Poker & Cocktail Hours', icon: 'music' },
        { id: 'es-5', time: '01:00', title: 'Final Cheers & Goodbyes', icon: 'moon' },
      ],
    },
  },
];

export function PartyScheduleModal({
  isOpen,
  onClose,
  schedule,
  onSave,
  simulatedTime,
  onSetSimulatedTime,
}: PartyScheduleModalProps) {
  const [localSchedule, setLocalSchedule] = useState<PartyProgramSchedule>(schedule);
  const [newCpTime, setNewCpTime] = useState('22:00');
  const [newCpTitle, setNewCpTitle] = useState('');
  const [newCpIcon, setNewCpIcon] = useState<PartyCheckpoint['icon']>('sparkles');

  // Preview time simulation slider
  const [previewSliderVal, setPreviewSliderVal] = useState<number>(() => {
    if (simulatedTime) return timeStringToMinutes(simulatedTime);
    return timeStringToMinutes(schedule.startTime);
  });
  const [isSimulationActive, setIsSimulationActive] = useState<boolean>(Boolean(simulatedTime));

  if (!isOpen) return null;

  const durationMins = calculatePartyDurationMinutes(
    localSchedule.startTime,
    localSchedule.endTime
  );
  const durationHours = (durationMins / 60).toFixed(1).replace('.0', '');

  const handleAddCheckpoint = () => {
    if (!newCpTitle.trim()) return;
    const newCp: PartyCheckpoint = {
      id: `cp-${Date.now()}`,
      time: newCpTime.trim(),
      title: newCpTitle.trim(),
      icon: newCpIcon,
    };

    setLocalSchedule(prev => ({
      ...prev,
      checkpoints: [...prev.checkpoints, newCp],
    }));

    setNewCpTitle('');
  };

  const handleRemoveCheckpoint = (id: string) => {
    setLocalSchedule(prev => ({
      ...prev,
      checkpoints: prev.checkpoints.filter(c => c.id !== id),
    }));
  };

  const handleUpdateCheckpoint = (
    id: string,
    field: keyof PartyCheckpoint,
    val: string
  ) => {
    setLocalSchedule(prev => ({
      ...prev,
      checkpoints: prev.checkpoints.map(c => (c.id === id ? { ...c, [field]: val } : c)),
    }));
  };

  const handleSaveAndApply = () => {
    onSave(localSchedule);
    if (isSimulationActive) {
      onSetSimulatedTime(minutesToTimeString(previewSliderVal));
    } else {
      onSetSimulatedTime(null);
    }
    onClose();
  };

  const handleResetDefaults = () => {
    setLocalSchedule(DEFAULT_PARTY_SCHEDULE);
    setIsSimulationActive(false);
    onSetSimulatedTime(null);
  };

  const handleApplyPreset = (preset: PartyProgramSchedule) => {
    setLocalSchedule(preset);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#121212] border border-white/20 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-black flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold lowercase">
                customize party timeline
              </h3>
              <p className="font-sans-clean text-xs text-white/50 lowercase">
                set party start, end point (e.g. 20:00 - 02:00) & hour milestones
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* 1. Quick Presets */}
          <div className="space-y-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/60 block">
              Quick Timeline Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_PROGRAMS.map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPreset(p.schedule)}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-sans-clean transition-all cursor-pointer hover:border-amber-400/50"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Start Time & End Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/[0.03] p-4 rounded-2xl border border-white/10">
            <div>
              <label className="font-mono text-[10px] uppercase font-bold text-white/70 block mb-1">
                Party Start Point *
              </label>
              <input
                type="time"
                value={localSchedule.startTime}
                onChange={e =>
                  setLocalSchedule(prev => ({ ...prev, startTime: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase font-bold text-white/70 block mb-1">
                Party End Point *
              </label>
              <input
                type="time"
                value={localSchedule.endTime}
                onChange={e =>
                  setLocalSchedule(prev => ({ ...prev, endTime: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-col justify-end">
              <div className="px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-center">
                <span className="font-mono text-[10px] uppercase font-bold text-amber-400 block">
                  Total Duration
                </span>
                <span className="font-mono text-sm font-bold text-white">
                  {durationHours} Hours ({durationMins}m)
                </span>
              </div>
            </div>
          </div>

          {/* 3. Checkpoints / Milestones List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/70">
                Party Checkpoints & Events ({localSchedule.checkpoints.length})
              </label>
              <span className="text-[11px] text-white/50 lowercase">
                shows as milestone dots along the bar
              </span>
            </div>

            {/* List of existing checkpoints */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {localSchedule.checkpoints.map(cp => (
                <div
                  key={cp.id}
                  className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2.5"
                >
                  <input
                    type="time"
                    value={cp.time}
                    onChange={e => handleUpdateCheckpoint(cp.id, 'time', e.target.value)}
                    className="w-24 px-2 py-1.5 rounded-lg bg-black/50 border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                  />

                  <input
                    type="text"
                    value={cp.title}
                    onChange={e => handleUpdateCheckpoint(cp.id, 'title', e.target.value)}
                    placeholder="Event Name (e.g. Singing hbd, cake)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-black/50 border border-white/20 text-white text-xs font-sans-clean focus:outline-none focus:border-amber-400"
                  />

                  <select
                    value={cp.icon || 'sparkles'}
                    onChange={e => handleUpdateCheckpoint(cp.id, 'icon', e.target.value)}
                    className="px-2 py-1.5 rounded-lg bg-black/50 border border-white/20 text-white text-xs focus:outline-none"
                  >
                    <option value="cake">🎂 Cake</option>
                    <option value="glass">🍹 Toast</option>
                    <option value="sparkles">✨ Event</option>
                    <option value="cards">🃏 Poker</option>
                    <option value="music">🎶 DJ</option>
                    <option value="flame">🔥 Peak</option>
                    <option value="moon">🌙 Late</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRemoveCheckpoint(cp.id)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors"
                    title="Delete Checkpoint"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new checkpoint row */}
            <div className="p-3 rounded-2xl bg-white/[0.02] border border-dashed border-white/20 space-y-2">
              <span className="font-mono text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                + Add Checkpoint
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="time"
                  value={newCpTime}
                  onChange={e => setNewCpTime(e.target.value)}
                  className="w-24 px-2.5 py-1.5 rounded-xl bg-black/60 border border-white/20 text-white font-mono text-xs"
                />

                <input
                  type="text"
                  value={newCpTitle}
                  onChange={e => setNewCpTitle(e.target.value)}
                  placeholder="e.g. 23:00 Singing Happy Birthday 🎉"
                  className="flex-1 min-w-[180px] px-3 py-1.5 rounded-xl bg-black/60 border border-white/20 text-white text-xs font-sans-clean"
                />

                <select
                  value={newCpIcon}
                  onChange={e => setNewCpIcon(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-xl bg-black/60 border border-white/20 text-white text-xs"
                >
                  <option value="cake">🎂 Cake</option>
                  <option value="glass">🍹 Toast</option>
                  <option value="sparkles">✨ Event</option>
                  <option value="cards">🃏 Poker</option>
                  <option value="music">🎶 DJ</option>
                  <option value="flame">🔥 Peak</option>
                  <option value="moon">🌙 Late</option>
                </select>

                <button
                  type="button"
                  onClick={handleAddCheckpoint}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-black font-sans-clean text-xs font-bold hover:bg-amber-300 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>add</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. Time Simulation / Preview Mode */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  Preview / Simulated Time Testing
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsSimulationActive(!isSimulationActive)}
                className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                  isSimulationActive
                    ? 'bg-amber-400 text-black'
                    : 'bg-white/10 text-white/60 hover:text-white'
                }`}
              >
                {isSimulationActive ? 'Manual Time Override Active' : 'Use Real Clock'}
              </button>
            </div>

            {isSimulationActive && (
              <div className="space-y-2 pt-1 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white/60">Simulated Wall-Clock Hour:</span>
                  <span className="text-amber-400 font-bold text-sm">
                    {minutesToTimeString(previewSliderVal)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1439"
                  step="15"
                  value={previewSliderVal}
                  onChange={e => setPreviewSliderVal(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <p className="text-[10px] text-white/50">
                  Slide to test how the progress bar and milestone dots highlight at different party hours before guests arrive.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between shrink-0 gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 text-xs font-sans-clean transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>reset defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-sans-clean text-white/70 hover:text-white transition-colors"
            >
              cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-5 py-2 rounded-xl bg-amber-400 text-black font-sans-clean font-bold text-xs hover:bg-amber-300 transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>apply schedule</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
