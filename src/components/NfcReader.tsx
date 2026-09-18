'use client';

import React, { useState, useEffect } from 'react';
import { Radio, Wifi, Smartphone, CheckCircle, AlertTriangle } from 'lucide-react';
import { isWebNfcSupported, nfcController } from '@/lib/nfc';
import { usePartyStore } from '@/lib/store';

interface NfcReaderProps {
  onTagScanned: (tagId: string) => void;
  activeTagId?: string | null;
  modeLabel?: string;
}

export function NfcReader({
  onTagScanned,
  activeTagId,
  modeLabel = 'ready for wristband tap',
}: NfcReaderProps) {
  const { guests } = usePartyStore();
  const [isSupported, setIsSupported] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [simTag, setSimTag] = useState('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(isWebNfcSupported());
  }, []);

  const startPhysicalNfc = async () => {
    setErrorMsg(null);
    const ok = await nfcController.startScan(
      tagId => {
        setLastScanned(tagId);
        onTagScanned(tagId);
      },
      err => {
        setErrorMsg(err.message);
        setIsScanning(false);
      }
    );
    if (ok) {
      setIsScanning(true);
    }
  };

  const handleSimulate = (tag: string) => {
    const clean = tag.trim().toUpperCase();
    if (!clean) return;
    setLastScanned(clean);
    onTagScanned(clean);
  };

  // Grab first 4 checked-in and 2 unassigned wristbands for easy simulation
  const quickTags = guests.slice(0, 6);

  return (
    <div className="w-full">
      {/* Primary Tap Area */}
      <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-gradient-to-b from-black/[0.02] to-black/[0.06] p-8 text-center backdrop-blur-md">
        {/* Animated NFC Radar Wave */}
        <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-black/5 animate-ping opacity-60" />
          <div className="absolute inset-2 rounded-full border border-black/20 animate-pulse" />
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-black text-white shadow-xl">
            <Radio className="h-9 w-9 animate-pulse" />
          </div>
        </div>

        <h3 className="font-display text-3xl font-bold lowercase text-black mb-2">
          {modeLabel}
        </h3>
        <p className="font-sans-clean text-xs text-black/60 lowercase max-w-md mx-auto mb-6">
          {isSupported
            ? 'hold physical wristband sticker to back of phone'
            : 'web nfc active / simulator enabled for development and testing'}
        </p>

        {/* Physical NFC Button for Android Chrome */}
        {isSupported && (
          <div className="mb-6">
            {!isScanning ? (
              <button
                type="button"
                onClick={startPhysicalNfc}
                className="btn-premium-primary gap-2"
              >
                <Radio className="w-4 h-4" />
                <span>start physical nfc scanner</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>phone nfc listening for wristbands...</span>
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {lastScanned && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black text-white text-xs font-mono font-bold tracking-wider">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>LAST TAP: {lastScanned}</span>
          </div>
        )}
      </div>

      {/* Interactive Simulator / Testing Dock */}
      <div className="mt-6 rounded-2xl border border-black/10 bg-white/60 p-5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-black/60" />
            <span className="font-sans-clean text-xs font-semibold uppercase tracking-wider text-black/80">
              NFC Simulator & Quick Test Tap
            </span>
          </div>
          <span className="text-[10px] text-black/40 font-sans-clean lowercase">
            pre-party testing mode
          </span>
        </div>

        {/* Quick Tap Chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {quickTags.map(g => {
            const isSelected = activeTagId === g.tag_id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => handleSimulate(g.tag_id)}
                className={`px-3 py-2 rounded-xl text-xs font-sans-clean transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-black text-white border-black shadow-md'
                    : 'bg-white hover:bg-black/5 text-black border-black/10'
                }`}
              >
                <span className="font-mono font-bold">{g.tag_id}</span>
                <span className="text-black/50 text-[11px]">
                  ({g.name || 'unassigned'})
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 text-black font-semibold">
                  {g.drinks_consumed}🍹
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom Tag Input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Type any tag ID (e.g. TAG-005)..."
            value={simTag}
            onChange={e => setSimTag(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleSimulate(simTag);
                setSimTag('');
              }
            }}
            className="flex-1 bg-white border border-black/15 rounded-xl px-3 py-2 text-xs font-mono uppercase text-black placeholder:text-black/30 outline-none focus:border-black"
          />
          <button
            type="button"
            onClick={() => {
              handleSimulate(simTag);
              setSimTag('');
            }}
            className="btn-premium py-2 px-4 text-xs whitespace-nowrap"
          >
            simulate tap
          </button>
        </div>
      </div>
    </div>
  );
}
