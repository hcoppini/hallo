'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Tv,
  Maximize2,
  Minimize2,
  Music,
  Users,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  ArrowRight,
  Sun,
  Moon,
  PlusCircle,
  Clock,
  DoorOpen,
  Monitor,
  ExternalLink,
  Flame,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { Guest } from '@/lib/types';
import { parseTagId } from '@/lib/tag-utils';
import { soundSystem } from '@/lib/audio';
import {
  PROJECTOR_PRESETS,
  parseYouTubeInput,
  YouTubePreset,
} from '@/lib/youtube-utils';
import {
  getEnteredGuestsSorted,
  calculateProjectorStats,
  formatWallClockTime,
  formatRelativeTime,
  formatCategoryLabel,
} from '@/lib/projector-utils';

export function ProjectorDisplay() {
  const { guests, checkIn, updateSettings } = usePartyStore();

  // Fullscreen container ref
  const stageContainerRef = useRef<HTMLDivElement>(null);

  // Responsive PC detection
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [forcePcMode, setForcePcMode] = useState(false);

  // Projector Display Preferences
  const [isCinemaMode, setIsCinemaMode] = useState(true); // Default to Cinema Noir for projectors
  const [splitRatio, setSplitRatio] = useState<'65_35' | '50_50' | '75_25'>('65_35');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playChimeOnArrival, setPlayChimeOnArrival] = useState(false);

  // YouTube Music Video State
  const [activePreset, setActivePreset] = useState<YouTubePreset>(PROJECTOR_PRESETS[0]);
  const [customInputUrl, setCustomInputUrl] = useState('');
  const [isCustomUrlOpen, setIsCustomUrlOpen] = useState(false);
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);
  const [activeEmbedUrl, setActiveEmbedUrl] = useState(() => {
    return parseYouTubeInput(PROJECTOR_PRESETS[0].videoId || '', { autoplay: true, muted: false }).embedUrl;
  });

  // Guest Feed State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'recent' | 'vip'>('all');
  const [lastAnnouncedGuestId, setLastAnnouncedGuestId] = useState<string | null>(null);
  const [newArrivalHighlightId, setNewArrivalHighlightId] = useState<string | null>(null);

  // Detect screen size on client
  useEffect(() => {
    const checkViewport = () => {
      setIsMobileScreen(window.innerWidth < 1024);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Filter and sort entered guests
  const enteredGuests = useMemo(() => getEnteredGuestsSorted(guests), [guests]);
  const stats = useMemo(() => calculateProjectorStats(guests), [guests]);

  // Latest entered guest for spotlight
  const latestGuest = enteredGuests[0] || null;

  // Detect newly admitted guests in real-time
  useEffect(() => {
    if (!latestGuest) return;

    if (lastAnnouncedGuestId && latestGuest.id !== lastAnnouncedGuestId) {
      // A brand new guest arrived!
      setNewArrivalHighlightId(latestGuest.id);
      if (playChimeOnArrival) {
        soundSystem.playCelebrationSound();
      }
      const timer = setTimeout(() => {
        setNewArrivalHighlightId(null);
      }, 8000);
      return () => clearTimeout(timer);
    }

    setLastAnnouncedGuestId(latestGuest.id);
  }, [latestGuest, lastAnnouncedGuestId, playChimeOnArrival]);

  // Filtered arrivals based on user search and filter tabs
  const filteredGuests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const thirtyMinMs = 30 * 60 * 1000;

    return enteredGuests.filter(guest => {
      // Category / Recent Filter
      if (activeFilter === 'vip' && guest.category !== 'vip') return false;
      if (activeFilter === 'recent') {
        if (!guest.entered_at) return false;
        const diff = now - new Date(guest.entered_at).getTime();
        if (diff > thirtyMinMs) return false;
      }

      // Search Query
      if (!query) return true;
      const nameMatch = (guest.name || '').toLowerCase().includes(query);
      const tagMatch = guest.tag_id.toLowerCase().includes(query);
      const tagNumMatch = parseTagId(guest.tag_id).tagNumber?.toString().includes(query);
      return nameMatch || tagMatch || Boolean(tagNumMatch);
    });
  }, [enteredGuests, searchQuery, activeFilter]);

  // Fullscreen Stage toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (stageContainerRef.current) {
          await stageContainerRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  };

  // Switch to a preset
  const handleSelectPreset = (preset: YouTubePreset) => {
    setActivePreset(preset);
    const result = parseYouTubeInput(preset.videoId || '', { autoplay: true, muted: false });
    setActiveEmbedUrl(result.embedUrl);
    setCustomUrlError(null);
  };

  // Submit custom YouTube URL
  const handleLoadCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInputUrl.trim()) return;

    const result = parseYouTubeInput(customInputUrl, { autoplay: true, muted: false });
    if (!result.isValid) {
      setCustomUrlError('Could not find a valid YouTube video or playlist ID in that URL.');
      return;
    }

    setActivePreset({
      id: 'custom-url',
      label: 'Custom YouTube Music Video',
      artist: 'User Selected Music',
      description: result.playlistId ? 'Custom YouTube Playlist' : 'Official YouTube Music Video',
      videoId: result.videoId || undefined,
      playlistId: result.playlistId || undefined,
    });
    setActiveEmbedUrl(result.embedUrl);
    setCustomUrlError(null);
    setIsCustomUrlOpen(false);
  };

  // Demo simulator: admits the next unadmitted guest for instant testing
  const handleSimulateCheckIn = async () => {
    const unadmitted = guests.find(g => !g.is_entered);
    if (!unadmitted) return;

    const demoNames = ['Maya (VIP)', 'Liam (Guest)', 'Sophie (Driver)', 'Kamil (Guest)', 'Zuzanna (VIP)'];
    const chosenName = demoNames[Math.floor(Math.random() * demoNames.length)];
    const isVip = chosenName.includes('VIP');
    const isDriver = chosenName.includes('Driver');

    await checkIn({
      tag_id: unadmitted.tag_id,
      name: chosenName,
      category: isVip ? 'vip' : isDriver ? 'driver_minor' : 'standard',
    });
  };

  // If user is on a small screen and hasn't forced PC mode
  if (isMobileScreen && !forcePcMode) {
    return (
      <div className="w-full max-w-xl mx-auto py-12 px-4 text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-black/5 border border-black/10 mx-auto flex items-center justify-center text-black">
          <Monitor className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-black/45">
            PC & PROJECTOR VIEW
          </span>
          <h1 className="font-display text-4xl font-bold lowercase text-black">
            optimized for wide displays.
          </h1>
          <p className="font-sans-clean text-xs sm:text-sm text-black/60 lowercase leading-relaxed max-w-md mx-auto">
            this music video station is built for laptops connected to 1080p / 4k venue projectors to project youtube music videos alongside live guest arrivals.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link href="/" className="btn-premium w-full sm:w-auto">
            <span>back to party hub</span>
          </Link>
          <button
            type="button"
            onClick={() => setForcePcMode(true)}
            className="btn-premium-primary w-full sm:w-auto gap-2"
          >
            <Monitor className="w-4 h-4" />
            <span>preview pc view anyway</span>
          </button>
        </div>
      </div>
    );
  }

  // Split layout classes
  const splitClasses = {
    '65_35': {
      video: 'lg:w-[65%]',
      feed: 'lg:w-[35%]',
    },
    '50_50': {
      video: 'lg:w-[50%]',
      feed: 'lg:w-[50%]',
    },
    '75_25': {
      video: 'lg:w-[75%]',
      feed: 'lg:w-[25%]',
    },
  }[splitRatio];

  const themeClasses = isCinemaMode
    ? 'bg-[#080808] text-white border-white/10'
    : 'bg-[#FAFAFA] text-black border-black/10';

  const cardThemeClasses = isCinemaMode
    ? 'bg-[#111111]/90 border-white/10 text-white shadow-2xl backdrop-blur-md'
    : 'bg-white border-black/10 text-black shadow-lg backdrop-blur-md';

  return (
    <div
      ref={stageContainerRef}
      className={`w-full min-h-[calc(100vh-6rem)] ${themeClasses} transition-colors duration-300 flex flex-col p-3 sm:p-5 lg:p-6 space-y-4`}
    >
      {/* ================================================================ */}
      {/* 1. TOP STAGE CONTROLS BAR (GENUINE STATUS, NO PLACEHOLDER PILLS) */}
      {/* ================================================================ */}
      <header
        className={`w-full rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 border ${cardThemeClasses}`}
      >
        {/* Left: Branding & Current Stream */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md">
              <Tv className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl sm:text-2xl font-bold lowercase tracking-tight leading-none">
                  projector stage
                </span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-current opacity-60">
                  PC WIDESCREEN
                </span>
              </div>
              <p className="font-sans-clean text-[11px] opacity-60 lowercase line-clamp-1 mt-0.5">
                {activePreset.label} &bull; {activePreset.description}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Live Attendance Counter (Actual Number, No Fake Pills) */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 opacity-70" />
            <div className="text-left">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-bold leading-none">
                  {stats.totalEntered}
                </span>
                <span className="font-sans-clean text-xs opacity-50">
                  / {stats.totalCapacity} inside
                </span>
              </div>
              <div className="w-24 h-1.5 rounded-full bg-current/10 overflow-hidden mt-1">
                <div
                  className="h-full bg-current rounded-full transition-all duration-500"
                  style={{ width: `${stats.fillPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {stats.recentEntriesCount > 0 && (
            <div className="hidden xl:flex items-center gap-1.5 font-sans-clean text-[11px] opacity-70 border-l border-current/15 pl-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{stats.recentEntriesCount} arrivals in last 30m</span>
            </div>
          )}
        </div>

        {/* Right: Stage Operator Tools */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Split Ratio Selector */}
          <div className="hidden xl:flex items-center gap-1 p-1 rounded-xl bg-current/5 border border-current/10 text-xs">
            <button
              type="button"
              onClick={() => setSplitRatio('65_35')}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                splitRatio === '65_35' ? 'bg-current/15 shadow-xs font-black' : 'opacity-60 hover:opacity-100'
              }`}
              title="65% Video / 35% Feed"
            >
              65:35
            </button>
            <button
              type="button"
              onClick={() => setSplitRatio('50_50')}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                splitRatio === '50_50' ? 'bg-current/15 shadow-xs font-black' : 'opacity-60 hover:opacity-100'
              }`}
              title="50% Video / 50% Feed"
            >
              50:50
            </button>
            <button
              type="button"
              onClick={() => setSplitRatio('75_25')}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                splitRatio === '75_25' ? 'bg-current/15 shadow-xs font-black' : 'opacity-60 hover:opacity-100'
              }`}
              title="75% Video / 25% Feed"
            >
              75:25
            </button>
          </div>

          {/* Theme Switcher: Cinema Noir vs Gallery White */}
          <button
            type="button"
            onClick={() => setIsCinemaMode(prev => !prev)}
            className="p-2 rounded-xl border border-current/15 hover:bg-current/10 transition-colors cursor-pointer"
            title={isCinemaMode ? 'Switch to Light Gallery Mode' : 'Switch to Cinema Noir Mode'}
          >
            {isCinemaMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-black" />}
          </button>

          {/* Door Entry Sound Chime */}
          <button
            type="button"
            onClick={() => setPlayChimeOnArrival(prev => !prev)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              playChimeOnArrival
                ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                : 'border-current/15 opacity-60 hover:opacity-100'
            }`}
            title={playChimeOnArrival ? 'Arrival Chime Enabled' : 'Arrival Chime Muted'}
          >
            {playChimeOnArrival ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Fullscreen Stage Mode */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-current/20 hover:bg-current/10 text-xs font-sans-clean font-bold tracking-wider lowercase transition-all cursor-pointer"
            title="Expand to Fullscreen Projector Canvas"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'exit stage' : 'stage fullscreen'}</span>
          </button>
        </div>
      </header>

      {/* ================================================================ */}
      {/* 2. DUAL SPLIT WORKSPACE: YOUTUBE MUSIC VIDEO + LIVE GUEST FEED    */}
      {/* ================================================================ */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-[640px]">
        {/* ============================================================== */}
        {/* LEFT VIEW: YOUTUBE MUSIC VIDEO PLAYER & TRACK CONTROLS         */}
        {/* ============================================================== */}
        <section className={`flex flex-col gap-4 ${splitClasses.video} transition-all duration-300`}>
          {/* Music Video Player Box */}
          <div
            className={`relative flex-1 min-h-[400px] lg:min-h-[500px] rounded-3xl overflow-hidden border ${cardThemeClasses} flex flex-col`}
          >
            {/* Embedded YouTube Music Video */}
            <div className="relative flex-1 w-full h-full bg-black flex items-center justify-center">
              <iframe
                title="YouTube Music Video Player"
                src={activeEmbedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full min-h-[380px] lg:min-h-[460px] border-none"
              />
            </div>

            {/* Video Footer Bar with Music Video Presets & Custom URL Trigger */}
            <div className="p-3.5 sm:p-4 border-t border-current/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Presets Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-50 mr-1 shrink-0">
                  MUSIC VIDEOS:
                </span>
                {PROJECTOR_PRESETS.map(preset => {
                  const isActive = activePreset.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`px-3 py-1.5 rounded-full text-xs font-sans-clean font-semibold tracking-wide lowercase shrink-0 transition-all cursor-pointer ${
                        isActive
                          ? isCinemaMode
                            ? 'bg-white text-black font-bold shadow-md'
                            : 'bg-black text-white font-bold shadow-md'
                          : 'opacity-65 hover:opacity-100 hover:bg-current/10'
                      }`}
                    >
                      {preset.label.split('–')[1]?.trim() || preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom YouTube Link Input Button */}
              <button
                type="button"
                onClick={() => setIsCustomUrlOpen(prev => !prev)}
                className="btn-premium py-1.5 px-3 text-xs gap-1.5 shrink-0 cursor-pointer text-inherit border-current/20 hover:border-current/40"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>custom music video / playlist</span>
              </button>
            </div>

            {/* Custom URL Drawer / Popover */}
            {isCustomUrlOpen && (
              <form
                onSubmit={handleLoadCustomUrl}
                className={`p-4 border-t border-current/10 flex flex-col sm:flex-row items-center gap-2 ${
                  isCinemaMode ? 'bg-[#181818]' : 'bg-[#F4F4F4]'
                }`}
              >
                <input
                  type="text"
                  value={customInputUrl}
                  onChange={e => setCustomInputUrl(e.target.value)}
                  placeholder="Paste any YouTube music video or playlist URL (e.g. https://youtu.be/...)"
                  className="flex-1 w-full px-3.5 py-2 rounded-xl text-xs font-sans-clean bg-transparent border border-current/20 focus:outline-none focus:border-current"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="submit"
                    className="btn-premium-primary py-2 px-4 text-xs font-bold w-full sm:w-auto"
                  >
                    play video
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCustomUrlOpen(false)}
                    className="btn-premium py-2 px-3 text-xs"
                  >
                    cancel
                  </button>
                </div>
                {customUrlError && (
                  <p className="w-full text-[11px] text-red-500 font-sans-clean mt-1">
                    {customUrlError}
                  </p>
                )}
              </form>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* RIGHT VIEW: LIVE FEED OF WHO ENTERED (GENUINE REALTIME FEED)   */}
        {/* ============================================================== */}
        <section className={`flex flex-col gap-4 ${splitClasses.feed} transition-all duration-300`}>
          <div className={`flex-1 rounded-3xl border ${cardThemeClasses} p-5 flex flex-col overflow-hidden`}>
            {/* Header: Title & Attendance Breakdown */}
            <div className="pb-4 border-b border-current/10 shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest opacity-50 block">
                    DOOR ADMISSIONS
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold lowercase tracking-tight leading-none">
                    live guest arrivals
                  </h2>
                </div>

                <div className="text-right">
                  <div className="font-display text-2xl font-bold leading-none">
                    {stats.totalEntered}
                  </div>
                  <span className="font-sans-clean text-[11px] opacity-60 lowercase">
                    guests checked in
                  </span>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <div className="relative w-full flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search arrived guest or #..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-sans-clean bg-current/5 border border-current/10 focus:outline-none focus:border-current/30 text-inherit placeholder:opacity-40"
                  />
                </div>

                <div className="flex items-center gap-1 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-sans-clean font-semibold tracking-wide lowercase cursor-pointer transition-all ${
                      activeFilter === 'all'
                        ? 'bg-current/15 font-bold shadow-xs'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    all ({enteredGuests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('recent')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-sans-clean font-semibold tracking-wide lowercase cursor-pointer transition-all ${
                      activeFilter === 'recent'
                        ? 'bg-current/15 font-bold shadow-xs'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    recent
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('vip')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-sans-clean font-semibold tracking-wide lowercase cursor-pointer transition-all ${
                      activeFilter === 'vip'
                        ? 'bg-current/15 font-bold shadow-xs'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    vip
                  </button>
                </div>
              </div>
            </div>

            {/* Spotlight Banner: Most Recent Guest Arrival */}
            {latestGuest && (
              <div
                className={`my-3 p-4 rounded-2xl border transition-all duration-300 shrink-0 ${
                  newArrivalHighlightId === latestGuest.id
                    ? 'border-amber-400 bg-amber-400/10 scale-[1.01]'
                    : isCinemaMode
                    ? 'border-white/15 bg-white/5'
                    : 'border-black/10 bg-black/[0.03]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider opacity-60 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>LATEST ARRIVAL SPOTLIGHT</span>
                  </span>
                  <span>{formatRelativeTime(latestGuest.entered_at)}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-current/10 border border-current/15 flex items-center justify-center font-mono text-xs font-bold">
                      {parseTagId(latestGuest.tag_id).tagNumber
                        ? `#${parseTagId(latestGuest.tag_id).tagNumber}`
                        : latestGuest.tag_id}
                    </div>
                    <div>
                      <h4 className="font-display text-2xl font-bold lowercase leading-tight">
                        {latestGuest.name || `Guest ${latestGuest.tag_id}`}
                      </h4>
                      <p className="font-sans-clean text-[11px] opacity-60 lowercase">
                        {formatCategoryLabel(latestGuest.category)} &bull; entered at{' '}
                        {formatWallClockTime(latestGuest.entered_at)}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-current/10 border border-current/15">
                    INSIDE
                  </span>
                </div>
              </div>
            )}

            {/* Scrollable Guest Feed */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2">
              {filteredGuests.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-60">
                  <DoorOpen className="w-8 h-8 opacity-40" />
                  <p className="font-sans-clean text-xs lowercase max-w-xs">
                    {searchQuery
                      ? 'No arrived guests match that search term.'
                      : 'No guest arrivals recorded yet. Scan wristbands at the Door Station to populate this live stream.'}
                  </p>
                </div>
              ) : (
                filteredGuests.map(guest => {
                  const tagNumber = parseTagId(guest.tag_id).tagNumber;
                  const tagDisplay = tagNumber ? `#${tagNumber.toString().padStart(3, '0')}` : guest.tag_id;
                  const isHighlighted = newArrivalHighlightId === guest.id;

                  return (
                    <div
                      key={guest.id}
                      className={`p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                        isHighlighted
                          ? 'border-amber-400 bg-amber-400/10'
                          : isCinemaMode
                          ? 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                          : 'border-black/5 bg-black/[0.02] hover:bg-black/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold opacity-60 w-12 text-left">
                          {tagDisplay}
                        </span>
                        <div>
                          <span className="font-display text-lg font-bold lowercase leading-tight block">
                            {guest.name || `Guest ${guest.tag_id}`}
                          </span>
                          <span className="font-sans-clean text-[10px] opacity-50 lowercase">
                            {formatCategoryLabel(guest.category)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-[11px] font-bold block opacity-75">
                          {formatWallClockTime(guest.entered_at)}
                        </span>
                        <span className="font-sans-clean text-[10px] opacity-40 lowercase">
                          {formatRelativeTime(guest.entered_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer: Quick Simulator for Venue Pre-Testing */}
            <div className="pt-3 border-t border-current/10 flex items-center justify-between text-xs opacity-60 shrink-0">
              <span className="font-sans-clean text-[11px] lowercase">
                real-time synchronization with door check-in
              </span>
              <button
                type="button"
                onClick={handleSimulateCheckIn}
                className="hover:opacity-100 underline decoration-current/30 text-[11px] font-sans-clean lowercase cursor-pointer"
                title="Test simulated guest admission"
              >
                + simulate check-in
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
