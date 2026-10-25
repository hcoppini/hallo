'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Tv,
  Maximize2,
  Minimize2,
  Users,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Plus,
  DoorOpen,
  Monitor,
  ListMusic,
  Trash2,
  Check,
  Music2,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { usePartyStore } from '@/lib/store';
import { Guest } from '@/lib/types';
import { parseTagId } from '@/lib/tag-utils';
import { soundSystem } from '@/lib/audio';
import {
  DEFAULT_PARTY_QUEUE,
  QueueItem,
  parseYouTubeInput,
  buildEmbedUrl,
} from '@/lib/youtube-utils';
import {
  getEnteredGuestsSorted,
  calculateProjectorStats,
  formatWallClockTime,
  formatRelativeTime,
} from '@/lib/projector-utils';

export function ProjectorDisplay() {
  const { guests, checkIn, refresh } = usePartyStore();

  const stageContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Responsive PC detection
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [forcePcMode, setForcePcMode] = useState(false);

  // Projector Stage State
  const [isCinemaMode, setIsCinemaMode] = useState(true);
  const [splitRatio, setSplitRatio] = useState<'65_35' | '50_50' | '75_25'>('65_35');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playChimeOnArrival, setPlayChimeOnArrival] = useState(false);

  // Music Queue & Playback State
  const [queue, setQueue] = useState<QueueItem[]>(DEFAULT_PARTY_QUEUE);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isShuffleOn, setIsShuffleOn] = useState(false);

  // Custom Input State
  const [customInputUrl, setCustomInputUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addUrlError, setAddUrlError] = useState<string | null>(null);

  // Guest Feed State
  const [lastAnnouncedGuestId, setLastAnnouncedGuestId] = useState<string | null>(null);
  const [newArrivalHighlightId, setNewArrivalHighlightId] = useState<string | null>(null);
  const [spotlightGuest, setSpotlightGuest] = useState<Guest | null>(null);

  const currentTrack: QueueItem = queue[currentTrackIndex] || queue[0] || DEFAULT_PARTY_QUEUE[0];
  const upcomingQueue = useMemo(() => {
    return queue.slice(currentTrackIndex + 1);
  }, [queue, currentTrackIndex]);

  // Embed URL for active video
  const activeEmbedUrl = useMemo(() => {
    return buildEmbedUrl({
      videoId: currentTrack.videoId,
      playlistId: currentTrack.playlistId,
      autoplay: true,
      muted: false,
    });
  }, [currentTrack]);

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

  // Send command to YouTube iframe via postMessage
  const postIframeCommand = (command: string, args: any[] = []) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: command, args }),
        '*'
      );
    }
  };

  // Skip to next track
  const handleNextTrack = () => {
    if (currentTrack.playlistId) {
      postIframeCommand('nextVideo');
    }
    if (currentTrackIndex < queue.length - 1) {
      setCurrentTrackIndex(prev => prev + 1);
      setIsPlaying(true);
    } else {
      // Loop back to start of queue
      setCurrentTrackIndex(0);
      setIsPlaying(true);
    }
  };

  // Go back to previous track
  const handlePrevTrack = () => {
    if (currentTrack.playlistId) {
      postIframeCommand('previousVideo');
    }
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(prev => prev - 1);
      setIsPlaying(true);
    } else {
      setCurrentTrackIndex(queue.length - 1);
      setIsPlaying(true);
    }
  };

  // Toggle play/pause
  const handleTogglePlay = () => {
    if (isPlaying) {
      postIframeCommand('pauseVideo');
      setIsPlaying(false);
    } else {
      postIframeCommand('playVideo');
      setIsPlaying(true);
    }
  };

  // Toggle shuffle
  const handleToggleShuffle = () => {
    if (currentTrack.playlistId) {
      postIframeCommand('setShuffle', [!isShuffleOn]);
    }
    if (!isShuffleOn) {
      // Shuffle upcoming items in queue
      const current = queue[currentTrackIndex];
      const rest = queue.filter((_, idx) => idx !== currentTrackIndex);
      const shuffledRest = [...rest].sort(() => Math.random() - 0.5);
      setQueue([current, ...shuffledRest]);
      setCurrentTrackIndex(0);
      setIsShuffleOn(true);
    } else {
      setIsShuffleOn(false);
    }
  };

  // Auto-advance when video finishes
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.event === 'onStateChange' && data?.info === 0) {
          // YT.PlayerState.ENDED (0) -> auto advance
          handleNextTrack();
        }
      } catch {}
    };
    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [currentTrackIndex, queue]);

  // Remove track from queue
  const handleRemoveTrack = (indexToRemove: number) => {
    setQueue(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (indexToRemove < currentTrackIndex) {
      setCurrentTrackIndex(prev => Math.max(0, prev - 1));
    }
  };

  // Jump directly to track in queue
  const handlePlayQueueItem = (targetIndex: number) => {
    setCurrentTrackIndex(targetIndex);
    setIsPlaying(true);
  };

  // Add custom URL / playlist to queue
  const handleAddCustomTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInputUrl.trim()) return;

    const parsed = parseYouTubeInput(customInputUrl, { autoplay: true, muted: false });
    if (!parsed.isValid) {
      setAddUrlError('Please enter a valid YouTube video or playlist URL.');
      return;
    }

    const newTrack: QueueItem = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim() || (parsed.playlistId ? 'Custom Playlist' : 'Custom Music Video'),
      artist: customArtist.trim() || 'Guest Queue',
      videoId: parsed.videoId || 'sOnqjkJTMaA',
      playlistId: parsed.playlistId || undefined,
    };

    setQueue(prev => [...prev, newTrack]);
    setCustomInputUrl('');
    setCustomTitle('');
    setCustomArtist('');
    setAddUrlError(null);
    setIsAddModalOpen(false);
  };

  // Fast background poll (every 2.5s) to guarantee zero latency even if WebSockets drop
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 2500);
    return () => clearInterval(interval);
  }, [refresh]);

  // Filter and sort entered guests
  const enteredGuests = useMemo(() => getEnteredGuestsSorted(guests), [guests]);
  const stats = useMemo(() => calculateProjectorStats(guests), [guests]);
  const latestGuest = enteredGuests[0] || null;

  // Realtime guest arrival detection with celebration animation + confetti
  useEffect(() => {
    if (!latestGuest) return;

    if (lastAnnouncedGuestId && latestGuest.id !== lastAnnouncedGuestId) {
      // NEW GUEST ARRIVED!
      setSpotlightGuest(latestGuest);
      setNewArrivalHighlightId(latestGuest.id);

      // Fire celebratory confetti on projector wall!
      try {
        confetti({
          particleCount: 75,
          spread: 80,
          origin: { y: 0.25 },
          colors: ['#ffffff', '#fbbf24', '#f59e0b', '#dc2626'],
        });
      } catch {}

      if (playChimeOnArrival) {
        soundSystem.playCelebrationSound();
      }

      const timer = setTimeout(() => {
        setNewArrivalHighlightId(null);
      }, 9000);
      return () => clearTimeout(timer);
    }

    setSpotlightGuest(latestGuest);
    setLastAnnouncedGuestId(latestGuest.id);
  }, [latestGuest, lastAnnouncedGuestId, playChimeOnArrival]);

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

  // Demo simulator: admits the next unadmitted guest for instant testing
  const handleSimulateCheckIn = async () => {
    const unadmitted = guests.find(g => !g.is_entered);
    if (!unadmitted) return;

    const demoNames = ['Maya', 'Aleksander', 'Kasia', 'Liam', 'Zuzanna', 'Piotr', 'Marta', 'Mateusz'];
    const chosenName = demoNames[Math.floor(Math.random() * demoNames.length)];

    await checkIn({
      tag_id: unadmitted.tag_id,
      name: chosenName,
      category: 'standard',
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
          <h1 className="font-display text-4xl font-bold lowercase text-black">
            projector widescreen view.
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
    ? 'bg-[#060606] text-white border-white/10'
    : 'bg-[#FAFAFA] text-black border-black/10';

  const cardThemeClasses = isCinemaMode
    ? 'bg-[#0f0f0f] border-white/10 text-white shadow-2xl'
    : 'bg-white border-black/10 text-black shadow-lg';

  return (
    <div
      ref={stageContainerRef}
      className={`w-full min-h-[calc(100vh-6rem)] ${themeClasses} transition-colors duration-300 flex flex-col p-3 sm:p-5 lg:p-6 space-y-4`}
    >
      {/* ================================================================ */}
      {/* 1. TOP STAGE CONTROLS BAR: CLEAN & UNCLUTTERED                   */}
      {/* ================================================================ */}
      <header
        className={`w-full rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 border ${cardThemeClasses}`}
      >
        {/* Left: Now Playing Status */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold lowercase tracking-tight leading-none">
                {currentTrack.title}
              </span>
              <span className="font-sans-clean text-xs opacity-60">
                — {currentTrack.artist}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Attendance Counter */}
        <div className="flex items-center gap-4">
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
            <div className="w-28 h-1.5 rounded-full bg-current/10 overflow-hidden mt-1">
              <div
                className="h-full bg-current rounded-full transition-all duration-500"
                style={{ width: `${stats.fillPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Stage Operator Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Split Ratio Selector */}
          <div className="hidden xl:flex items-center gap-1 p-1 rounded-xl bg-current/5 border border-current/10 text-xs">
            <button
              type="button"
              onClick={() => setSplitRatio('65_35')}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                splitRatio === '65_35' ? 'bg-current/15 font-black' : 'opacity-60 hover:opacity-100'
              }`}
              title="65% Video / 35% Feed"
            >
              65:35
            </button>
            <button
              type="button"
              onClick={() => setSplitRatio('50_50')}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                splitRatio === '50_50' ? 'bg-current/15 font-black' : 'opacity-60 hover:opacity-100'
              }`}
              title="50% Video / 50% Feed"
            >
              50:50
            </button>
            <button
              type="button"
              onClick={() => setSplitRatio('75_25')}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                splitRatio === '75_25' ? 'bg-current/15 font-black' : 'opacity-60 hover:opacity-100'
              }`}
              title="75% Video / 25% Feed"
            >
              75:25
            </button>
          </div>

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
        {/* LEFT VIEW: YOUTUBE MUSIC VIDEO PLAYER + QUEUE WORKSPACE        */}
        {/* ============================================================== */}
        <section className={`flex flex-col gap-3 ${splitClasses.video} transition-all duration-300`}>
          {/* Music Video Canvas */}
          <div
            className={`relative flex-1 min-h-[420px] lg:min-h-[500px] rounded-3xl overflow-hidden border ${cardThemeClasses} flex flex-col`}
          >
            {/* Embedded YouTube Player */}
            <div className="relative flex-1 w-full h-full bg-black flex items-center justify-center">
              <iframe
                ref={iframeRef}
                title="YouTube Music Video Player"
                src={activeEmbedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full min-h-[380px] lg:min-h-[480px] border-none"
              />
            </div>

            {/* Playback Controls & Action Ribbon */}
            <div className="p-3.5 sm:p-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#0a0a0a] shrink-0">
              {/* Transport Controls: Prev, Play/Pause, Next, Shuffle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevTrack}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95"
                  title="Go Back (Previous Track)"
                >
                  <SkipBack className="w-4 h-4 fill-white" />
                </button>

                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="p-3 rounded-full bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer active:scale-95 shadow-md"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-black" />
                  ) : (
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95"
                  title="Skip to Next Track"
                >
                  <SkipForward className="w-4 h-4 fill-white" />
                </button>

                <button
                  type="button"
                  onClick={handleToggleShuffle}
                  className={`p-2.5 rounded-full transition-all cursor-pointer active:scale-95 ${
                    isShuffleOn
                      ? 'bg-amber-400 text-black font-bold shadow-md'
                      : 'bg-white/10 hover:bg-white/20 text-white opacity-70 hover:opacity-100'
                  }`}
                  title={isShuffleOn ? 'Shuffle Enabled' : 'Shuffle Queue'}
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>

              {/* High-Contrast "+ Add Playlist or Music Video" Button */}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 rounded-full font-sans-clean font-bold text-xs tracking-wider lowercase transition-all cursor-pointer active:scale-95 flex items-center gap-2 bg-white text-black hover:bg-neutral-200 border border-white shadow-lg"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>add video or playlist</span>
              </button>
            </div>
          </div>

          {/* UP NEXT ON QUEUE BAR (Replaces static 8 songs buttons) */}
          <div className={`p-4 rounded-2xl border ${cardThemeClasses} shrink-0 space-y-2`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-white/90">
                  UP NEXT ON QUEUE ({upcomingQueue.length})
                </span>
              </div>
              <span className="font-mono text-[11px] text-white/50">
                Track {currentTrackIndex + 1} of {queue.length}
              </span>
            </div>

            {/* Upcoming Track Strip */}
            {upcomingQueue.length === 0 ? (
              <div className="py-2 text-xs text-white/40 font-sans-clean">
                End of queue reached. Click &quot;+ Add Video or Playlist&quot; to queue more music videos.
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {upcomingQueue.map((track, relativeIdx) => {
                  const absoluteIdx = currentTrackIndex + 1 + relativeIdx;
                  return (
                    <div
                      key={track.id}
                      className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 flex items-center gap-2.5 shrink-0 transition-all group"
                    >
                      <button
                        type="button"
                        onClick={() => handlePlayQueueItem(absoluteIdx)}
                        className="text-left cursor-pointer"
                        title="Play This Track Now"
                      >
                        <span className="font-sans-clean text-xs font-bold text-white block leading-tight group-hover:text-amber-300">
                          {track.title}
                        </span>
                        <span className="font-sans-clean text-[10px] text-white/50 block leading-tight mt-0.5">
                          {track.artist}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveTrack(absoluteIdx)}
                        className="p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-white/10 transition-colors ml-1 cursor-pointer"
                        title="Remove from Queue"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* RIGHT VIEW: LIVE FEED OF WHO ENTERED (CLEAN & RAPID SYNC)      */}
        {/* ============================================================== */}
        <section className={`flex flex-col gap-4 ${splitClasses.feed} transition-all duration-300`}>
          <div className={`flex-1 rounded-3xl border ${cardThemeClasses} p-5 flex flex-col overflow-hidden`}>
            {/* Header: Title & Total Count */}
            <div className="pb-3 border-b border-white/10 shrink-0 flex items-center justify-between">
              <div>
                <h2 className="font-display text-3xl font-bold lowercase tracking-tight leading-none text-white">
                  live guest arrivals
                </h2>
              </div>

              <div className="text-right">
                <span className="font-display text-2xl font-bold leading-none text-white">
                  {stats.totalEntered}
                </span>
                <span className="font-sans-clean text-[11px] opacity-60 lowercase block">
                  entered
                </span>
              </div>
            </div>

            {/* Spotlight Banner: Most Recent Guest Arrival with Entrance Animation */}
            {spotlightGuest && (
              <div
                className={`my-3 p-4 rounded-2xl border transition-all duration-300 shrink-0 animate-in fade-in zoom-in-95 ${
                  newArrivalHighlightId === spotlightGuest.id
                    ? 'border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/30 scale-[1.02]'
                    : 'border-white/15 bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    <span>JUST ARRIVED</span>
                  </span>
                  <span className="text-white/60">
                    {formatRelativeTime(spotlightGuest.entered_at)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-mono text-sm font-bold text-white shadow-xs">
                      {parseTagId(spotlightGuest.tag_id).tagNumber
                        ? `#${parseTagId(spotlightGuest.tag_id).tagNumber}`
                        : spotlightGuest.tag_id}
                    </div>
                    <div>
                      <h4 className="font-display text-2xl sm:text-3xl font-bold lowercase leading-tight text-white">
                        {spotlightGuest.name || `Guest ${spotlightGuest.tag_id}`}
                      </h4>
                      <p className="font-sans-clean text-xs text-white/60 lowercase">
                        admitted at {formatWallClockTime(spotlightGuest.entered_at)}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white shrink-0">
                    INSIDE
                  </span>
                </div>
              </div>
            )}

            {/* Scrollable Guest Feed (Uncluttered, No Search Bar, Smooth Transitions) */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2">
              {enteredGuests.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-60">
                  <DoorOpen className="w-8 h-8 opacity-40 text-white" />
                  <p className="font-sans-clean text-xs lowercase max-w-xs text-white/70">
                    No guest arrivals recorded yet. Scan wristbands at the Door Station to populate this live stream.
                  </p>
                </div>
              ) : (
                enteredGuests.map((guest, idx) => {
                  const tagNumber = parseTagId(guest.tag_id).tagNumber;
                  const tagDisplay = tagNumber ? `#${tagNumber.toString().padStart(3, '0')}` : guest.tag_id;
                  const isNewArrival = newArrivalHighlightId === guest.id;

                  return (
                    <div
                      key={guest.id}
                      className={`p-3 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3 ${
                        isNewArrival
                          ? 'border-amber-400 bg-amber-400/10 shadow-md'
                          : idx === 0
                          ? 'border-white/15 bg-white/[0.04]'
                          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs font-bold text-white/70 w-12 text-left shrink-0">
                          {tagDisplay}
                        </span>
                        <div className="min-w-0">
                          <span className="font-display text-xl font-bold lowercase leading-tight text-white block truncate">
                            {guest.name || `Guest ${guest.tag_id}`}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-bold block text-white/80">
                          {formatWallClockTime(guest.entered_at)}
                        </span>
                        <span className="font-sans-clean text-[10px] text-white/40 lowercase">
                          {formatRelativeTime(guest.entered_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Instant Test Check-in */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs opacity-60 shrink-0">
              <span className="font-sans-clean text-[11px] lowercase text-white/70">
                0ms live synchronization with /door station
              </span>
              <button
                type="button"
                onClick={handleSimulateCheckIn}
                className="hover:opacity-100 underline decoration-white/30 text-[11px] font-sans-clean lowercase cursor-pointer text-white"
                title="Simulate instant guest admission"
              >
                + test check-in
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ================================================================ */}
      {/* 3. ADD VIDEO / PLAYLIST MODAL                                    */}
      {/* ================================================================ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#141414] border border-white/20 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Music2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-display text-2xl font-bold lowercase text-white">
                  add video or playlist
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomTrack} className="space-y-3">
              <div>
                <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                  YouTube Video or Playlist URL *
                </label>
                <input
                  type="text"
                  required
                  value={customInputUrl}
                  onChange={e => setCustomInputUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or playlist?list=..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-sans-clean focus:outline-none focus:border-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                    Song / Video Title (optional)
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    placeholder="e.g. Bohemian Rhapsody"
                    className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-sans-clean focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                    Artist / Note (optional)
                  </label>
                  <input
                    type="text"
                    value={customArtist}
                    onChange={e => setCustomArtist(e.target.value)}
                    placeholder="e.g. Queen"
                    className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-sans-clean focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              {addUrlError && (
                <p className="text-xs text-red-400 font-sans-clean">
                  {addUrlError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-sans-clean font-semibold text-white/70 hover:text-white"
                >
                  cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full text-xs font-sans-clean font-bold bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer shadow-md"
                >
                  add to queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
