'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  Search,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Hash,
  ListFilter,
  CheckCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { parseTagId } from '@/lib/tag-utils';
import { subscribeToTagRelay, sendTagRelayMessage } from '@/lib/tag-relay';
import { soundSystem } from '@/lib/audio';
import { nfcController, isWebNfcSupported } from '@/lib/nfc';

export interface AuditedTag {
  id: string; // Canonical tag (e.g. TAG-069)
  num: number | null; // Extracted number (e.g. 69)
  count: number; // Scan count
  firstSeen: number;
  lastSeen: number;
  hardwareUid?: string;
}

export interface LastScanEvent {
  tagId: string;
  tagNum: number | null;
  isDuplicate: boolean;
  count: number;
  timestamp: number;
}

interface NfcAuditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NfcAuditorModal({ isOpen, onClose }: NfcAuditorModalProps) {
  const [scannedMap, setScannedMap] = useState<Record<string, AuditedTag>>({});
  const [lastScan, setLastScan] = useState<LastScanEvent | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [copiedMissing, setCopiedMissing] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'verified' | 'missing' | 'duplicates'>('all');
  const lastScanKeyRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });

  // Reset state and mark auditor active when opening fresh
  useEffect(() => {
    if (isOpen) {
      setIsDone(false);
      if (typeof window !== 'undefined') {
        (window as any).__nfcAuditorActive = true;
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__nfcAuditorActive = false;
      }
    };
  }, [isOpen]);

  // Core Tag Ingestion Handler
  const processIncomingTag = (rawTag: string, hwUid?: string) => {
    if (!rawTag) return;
    const now = Date.now();
    const cleanRaw = rawTag.trim();

    // 500ms debounce for RF bounce on same physical chip
    const debounceKey = (hwUid || cleanRaw).toUpperCase();
    if (debounceKey === lastScanKeyRef.current.key && now - lastScanKeyRef.current.time < 500) {
      return;
    }
    lastScanKeyRef.current = { key: debounceKey, time: now };

    const parsed = parseTagId(cleanRaw);
    const canonical = parsed.canonicalTag || cleanRaw.toUpperCase();
    const tagNum = parsed.tagNumber;

    setScannedMap(prev => {
      const existing = prev[canonical];
      const count = existing ? existing.count + 1 : 1;
      const isDuplicate = count > 1;

      if (isDuplicate) {
        soundSystem.playWarningSound();
      } else {
        soundSystem.playApprovedSound();
      }

      setLastScan({
        tagId: canonical,
        tagNum,
        isDuplicate,
        count,
        timestamp: now,
      });

      return {
        ...prev,
        [canonical]: {
          id: canonical,
          num: tagNum,
          count,
          firstSeen: existing ? existing.firstSeen : now,
          lastSeen: now,
          hardwareUid: hwUid || existing?.hardwareUid,
        },
      };
    });
  };

  // 1. Listen to Local ACR122U Hardware Bridge & Supabase Realtime Relay
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeToTagRelay(msg => {
      if (msg.type === 'TAG_TAPPED' && (msg.tagId || msg.rawId)) {
        processIncomingTag(msg.tagId || msg.rawId || '', msg.hardwareUid || msg.rawId);
      }
    });

    return () => unsubscribe();
  }, [isOpen]);

  // 2. Listen to Web NFC on mobile Android/Chrome if available
  useEffect(() => {
    if (!isOpen) return;
    if (isWebNfcSupported() && !nfcController.getScanningState()) {
      nfcController.startScan((tagId, hardwareUid) => {
        processIncomingTag(tagId, hardwareUid);
      });
    }
  }, [isOpen]);

  // Scanned list and range calculations
  const scannedList = useMemo(() => Object.values(scannedMap), [scannedMap]);

  const numericTags = useMemo(
    () => scannedList.filter(t => t.num !== null && !isNaN(t.num)),
    [scannedList]
  );

  const scannedNumbersSet = useMemo(
    () => new Set(numericTags.map(t => t.num as number)),
    [numericTags]
  );

  const { minNum, maxNum } = useMemo(() => {
    if (numericTags.length === 0) return { minNum: null, maxNum: null };
    const nums = numericTags.map(t => t.num as number);
    return {
      minNum: Math.min(...nums),
      maxNum: Math.max(...nums),
    };
  }, [numericTags]);

  // Missing numbers calculation between minNum and maxNum
  const missingNumbers = useMemo(() => {
    if (minNum === null || maxNum === null || minNum >= maxNum) return [];
    const missing: number[] = [];
    for (let n = minNum; n <= maxNum; n++) {
      if (!scannedNumbersSet.has(n)) {
        missing.push(n);
      }
    }
    return missing;
  }, [minNum, maxNum, scannedNumbersSet]);

  const duplicates = useMemo(
    () => scannedList.filter(t => t.count > 1),
    [scannedList]
  );

  const totalDuplicatesCount = useMemo(
    () => scannedList.reduce((acc, t) => acc + (t.count > 1 ? t.count - 1 : 0), 0),
    [scannedList]
  );

  // Trigger celebration if user clicks Done and 0 are missing
  const handleDone = () => {
    setIsDone(true);
    if (numericTags.length > 0 && missingNumbers.length === 0 && duplicates.length === 0) {
      confetti({
        particleCount: 55,
        spread: 60,
        origin: { y: 0.6 },
      });
      soundSystem.playApprovedSound();
    } else if (missingNumbers.length > 0) {
      soundSystem.playWarningSound();
    }
  };

  const handleReset = () => {
    soundSystem.vibrate(20);
    setScannedMap({});
    setLastScan(null);
    setIsDone(false);
  };

  const handleCopyMissing = () => {
    if (missingNumbers.length === 0) return;
    const text = missingNumbers.map(n => `#${n} (TAG-${n.toString().padStart(3, '0')})`).join(', ');
    navigator.clipboard.writeText(`Missing tags (${missingNumbers.length}): ${text}`);
    soundSystem.playApprovedSound();
    setCopiedMissing(true);
    setTimeout(() => setCopiedMissing(false), 2500);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processIncomingTag(manualInput.trim());
    setManualInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-0 sm:p-4">
      <div className="bottom-sheet max-w-2xl w-full p-5 sm:p-7 relative bg-white border-t sm:border border-black/15 shadow-2xl rounded-t-[32px] sm:rounded-3xl max-h-[92dvh] flex flex-col overflow-hidden pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:pb-7">
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-3 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-black/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-sm">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl font-bold lowercase text-black leading-tight">
                  nfc tag auditor & verifier
                </h2>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  listening
                </span>
              </div>
              <p className="font-sans-clean text-xs text-black/50 lowercase mt-0.5">
                tap physical stickers on the reader to detect duplicates & missing sequence numbers
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-black/40 hover:text-black hover:bg-black/5 transition-colors cursor-pointer"
            title="Close Auditor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Live Tap Spotlight Banner */}
          {lastScan ? (
            <div
              className={`p-4 rounded-2xl border transition-all animate-in zoom-in-95 duration-150 flex items-center justify-between gap-3 shadow-sm ${
                lastScan.isDuplicate
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-950'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    lastScan.isDuplicate
                      ? 'bg-amber-500 text-black'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  {lastScan.isDuplicate ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-black">
                      {lastScan.tagId}
                    </span>
                    {lastScan.tagNum !== null && (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-black text-white">
                        #{lastScan.tagNum}
                      </span>
                    )}
                    {lastScan.isDuplicate && (
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                        REPEAT x{lastScan.count}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-sans-clean text-black/60 lowercase truncate mt-0.5">
                    {lastScan.isDuplicate
                      ? `⚠️ this wristband was already scanned previously!`
                      : `verified clean — added to audited sequence`}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono text-[10px] text-black/40 block">
                  {new Date(lastScan.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-black/[0.025] border border-dashed border-black/15 text-center space-y-1 py-6">
              <Radio className="w-7 h-7 text-black/30 mx-auto animate-pulse" />
              <div className="font-sans-clean font-bold text-xs text-black lowercase">
                ready for wristbands
              </div>
              <div className="font-sans-clean text-[11px] text-black/45 lowercase max-w-sm mx-auto">
                tap each physical sticker on your acr122u reader. each tap is instantly verified against sequence duplicates.
              </div>
            </div>
          )}

          {/* 4-KPI Range Strip: Smallest, Biggest, Total Unique, Missing */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Smallest Number */}
            <div className="p-3.5 rounded-2xl bg-black/[0.03] border border-black/8">
              <span className="font-sans-clean text-[10px] font-bold uppercase tracking-wider text-black/40 block">
                smallest
              </span>
              <div className="font-mono text-2xl font-bold text-black mt-0.5">
                {minNum !== null ? `#${minNum}` : '—'}
              </div>
              <span className="font-sans-clean text-[10px] text-black/45 lowercase block truncate">
                {minNum !== null ? `TAG-${minNum.toString().padStart(3, '0')}` : 'none yet'}
              </span>
            </div>

            {/* Biggest Number */}
            <div className="p-3.5 rounded-2xl bg-black/[0.03] border border-black/8">
              <span className="font-sans-clean text-[10px] font-bold uppercase tracking-wider text-black/40 block">
                biggest
              </span>
              <div className="font-mono text-2xl font-bold text-black mt-0.5">
                {maxNum !== null ? `#${maxNum}` : '—'}
              </div>
              <span className="font-sans-clean text-[10px] text-black/45 lowercase block truncate">
                {maxNum !== null ? `TAG-${maxNum.toString().padStart(3, '0')}` : 'none yet'}
              </span>
            </div>

            {/* Unique Scanned */}
            <div className="p-3.5 rounded-2xl bg-black/[0.03] border border-black/8">
              <span className="font-sans-clean text-[10px] font-bold uppercase tracking-wider text-black/40 block">
                unique tags
              </span>
              <div className="font-mono text-2xl font-bold text-black mt-0.5">
                {scannedList.length}
              </div>
              <span className="font-sans-clean text-[10px] text-black/45 lowercase block truncate">
                {totalDuplicatesCount > 0 ? `+${totalDuplicatesCount} duplicates` : '0 duplicates'}
              </span>
            </div>

            {/* Missing In Range */}
            <div
              className={`p-3.5 rounded-2xl border transition-colors ${
                missingNumbers.length > 0
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : minNum !== null
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-black/[0.03] border border-black/8'
              }`}
            >
              <span className="font-sans-clean text-[10px] font-bold uppercase tracking-wider text-black/40 block">
                missing in range
              </span>
              <div
                className={`font-mono text-2xl font-bold mt-0.5 ${
                  missingNumbers.length > 0
                    ? 'text-amber-900'
                    : minNum !== null
                    ? 'text-emerald-700'
                    : 'text-black'
                }`}
              >
                {missingNumbers.length}
              </div>
              <span className="font-sans-clean text-[10px] text-black/45 lowercase block truncate">
                {missingNumbers.length > 0
                  ? 'needs re-writing'
                  : minNum !== null
                  ? 'full sequence solid'
                  : 'tap tags to start'}
              </span>
            </div>
          </div>

          {/* Missing Numbers Alert Banner */}
          {minNum !== null && maxNum !== null && (
            <div className="space-y-2">
              {missingNumbers.length > 0 ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-bold text-xs font-sans-clean lowercase">
                        {missingNumbers.length} {missingNumbers.length === 1 ? 'tag is' : 'tags are'} missing between #{minNum} and #{maxNum}:
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyMissing}
                      className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-200 text-amber-900 text-[11px] font-bold font-sans-clean flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedMissing ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedMissing ? 'copied!' : 'copy list'}</span>
                    </button>
                  </div>

                  {/* Pills of missing tags */}
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-white/70 rounded-xl border border-amber-200/60">
                    {missingNumbers.map(n => (
                      <span
                        key={n}
                        className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                      >
                        #{n} is missing
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-xs font-sans-clean lowercase">
                      perfect sequence! all {scannedList.length} tags between #{minNum} and #{maxNum} are verified with 0 missing!
                    </span>
                  </div>
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              )}
            </div>
          )}

          {/* Sequence Visual Grid & Filter */}
          <div className="space-y-2 pt-2 border-t border-black/8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ListFilter className="w-3.5 h-3.5 text-black/50" />
                <span className="font-sans-clean text-xs font-bold text-black lowercase">
                  sequence inspection
                </span>
                <span className="font-mono text-[10px] text-black/50">
                  ({scannedList.length} scanned)
                </span>
              </div>

              {/* View Filters */}
              <div className="flex items-center gap-1 bg-black/[0.04] p-1 rounded-xl text-[11px] font-sans-clean lowercase">
                {(['all', 'missing', 'duplicates'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setViewFilter(tab)}
                    className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                      viewFilter === tab
                        ? 'bg-black text-white font-bold'
                        : 'text-black/50 hover:text-black'
                    }`}
                  >
                    {tab}
                    {tab === 'missing' && missingNumbers.length > 0 && (
                      <span className="ml-1 px-1 rounded-full bg-amber-500 text-black text-[9px] font-bold">
                        {missingNumbers.length}
                      </span>
                    )}
                    {tab === 'duplicates' && duplicates.length > 0 && (
                      <span className="ml-1 px-1 rounded-full bg-amber-500 text-black text-[9px] font-bold">
                        {duplicates.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Badges Grid */}
            <div className="p-3 bg-black/[0.02] border border-black/8 rounded-2xl max-h-52 overflow-y-auto">
              {viewFilter === 'missing' ? (
                missingNumbers.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
                    {missingNumbers.map(n => (
                      <div
                        key={n}
                        className="p-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-center font-mono"
                      >
                        <div className="text-[10px] uppercase font-bold text-amber-700">MISSING</div>
                        <div className="text-sm font-bold">#{n}</div>
                        <div className="text-[9px] text-amber-800/80">TAG-{n.toString().padStart(3, '0')}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs font-sans-clean text-black/40 lowercase">
                    no missing tags in sequence!
                  </div>
                )
              ) : viewFilter === 'duplicates' ? (
                duplicates.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {duplicates.map(t => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-black font-mono text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold">{t.id}</div>
                          {t.num !== null && <div className="text-[10px] text-black/50">#{t.num}</div>}
                        </div>
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-300 text-amber-950 font-bold text-[10px]">
                          x{t.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs font-sans-clean text-black/40 lowercase">
                    zero repeated tags detected!
                  </div>
                )
              ) : (
                /* ALL SCANNED TAGS */
                scannedList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {scannedList
                      .sort((a, b) => (a.num ?? 9999) - (b.num ?? 9999))
                      .map(t => (
                        <div
                          key={t.id}
                          className={`px-2.5 py-1.5 rounded-xl border font-mono text-xs flex items-center gap-2 ${
                            t.count > 1
                              ? 'bg-amber-50 border-amber-300 text-amber-950'
                              : 'bg-white border-black/10 text-black shadow-2xs'
                          }`}
                        >
                          <span className="font-bold">{t.id}</span>
                          {t.num !== null && (
                            <span className="px-1 py-0.2 rounded bg-black/5 text-[10px] font-bold text-black/70">
                              #{t.num}
                            </span>
                          )}
                          {t.count > 1 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-300 text-amber-950 font-bold text-[10px]">
                              x{t.count}
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs font-sans-clean text-black/40 lowercase">
                    no tags scanned yet. tap wristbands to inspect!
                  </div>
                )
              )}
            </div>
          </div>

          {/* Manual Input / Test Tap Form (for quick testing or manual verification) */}
          <form onSubmit={handleManualSubmit} className="pt-2 border-t border-black/8 flex gap-2">
            <input
              type="text"
              placeholder="Manual test tap (e.g. 69 or TAG-069 or URL)..."
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              className="flex-1 px-3 py-2 bg-black/[0.035] border border-black/12 rounded-xl font-mono text-xs text-black placeholder:text-black/35 outline-none focus:bg-white focus:border-black transition-colors"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-3.5 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-black/85 disabled:opacity-40 transition-all cursor-pointer shrink-0"
            >
              Add / Test
            </button>
          </form>
        </div>

        {/* Modal Action Bar Footer */}
        <div className="pt-3.5 border-t border-black/10 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={scannedList.length === 0}
            className="px-3.5 py-2 rounded-xl text-xs font-bold font-sans-clean text-black/60 hover:text-black hover:bg-black/5 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>restart audit</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDone}
              className="px-5 py-2.5 rounded-xl bg-black text-white text-xs font-bold font-sans-clean hover:bg-black/85 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>done / check sequence</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
