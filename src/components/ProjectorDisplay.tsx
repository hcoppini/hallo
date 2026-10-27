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
  Music2,
  X,
  Loader2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Trophy,
  QrCode,
  Clock,
  Layers,
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
import { PartyProgressBar } from './PartyProgressBar';
import { PartyScheduleModal } from './PartyScheduleModal';
import { PokerWidget } from './PokerWidget';
import { PartyFunStatsWidget } from './PartyFunStatsWidget';
import { PartyQrHubWidget } from './PartyQrHubWidget';
import {
  PartyProgramSchedule,
  loadPartySchedule,
  savePartySchedule,
} from '@/lib/party-schedule-utils';

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
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [addUrlError, setAddUrlError] = useState<string | null>(null);

  // Guest Feed State
  const [lastAnnouncedGuestId, setLastAnnouncedGuestId] = useState<string | null>(null);
  const [newArrivalHighlightId, setNewArrivalHighlightId] = useState<string | null>(null);
  const [spotlightGuest, setSpotlightGuest] = useState<Guest | null>(null);

  // Party Program Progress Bar State
  const [partySchedule, setPartySchedule] = useState<PartyProgramSchedule>(() => loadPartySchedule());
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [simulatedTime, setSimulatedTime] = useState<string | null>(null);

  // Arrivals Feed & Lounge Widget State
  const [isArrivalsCollapsed, setIsArrivalsCollapsed] = useState(false);
  const [activeLoungeTab, setActiveLoungeTab] = useState<'poker' | 'stats' | 'qrs'>('poker');
  const [collapsedArrivalToast, setCollapsedArrivalToast] = useState<string | null>(null);

  const currentTrack: QueueItem = queue[currentTrackIndex] || queue[0] || DEFAULT_PARTY_QUEUE[0];
  const upcomingQueue = useMemo(() => {
    return queue.slice(currentTrackIndex + 1);
  }, [queue, currentTrackIndex]);

  // Embed URL for active video
  const activeEmbedUrl = useMemo(() => {
    return buildEmbedUrl({
      videoId: currentTrack.videoId,
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

  // Skip to next track in queue
  const handleNextTrack = () => {
    if (currentTrackIndex < queue.length - 1) {
      setCurrentTrackIndex(prev => prev + 1);
      setIsPlaying(true);
    } else {
      // Loop back to start of queue
      setCurrentTrackIndex(0);
      setIsPlaying(true);
    }
  };

  // Go back to previous track in queue
  const handlePrevTrack = () => {
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

  // Shuffle array helper (Fisher-Yates)
  const shuffleArray = <T,>(arr: T[]): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  // Toggle shuffle & shuffle upcoming queue
  const handleToggleShuffle = () => {
    const nextShuffleState = !isShuffleOn;
    setIsShuffleOn(nextShuffleState);

    if (nextShuffleState) {
      // Shuffle all upcoming tracks in the queue
      const current = queue[currentTrackIndex];
      const past = queue.slice(0, currentTrackIndex);
      const upcoming = queue.slice(currentTrackIndex + 1);
      const shuffledUpcoming = shuffleArray(upcoming);

      setQueue([...past, current, ...shuffledUpcoming]);
    }
  };

  // Dedicated Shuffle Queue button
  const handleShuffleUpcomingQueue = () => {
    setIsShuffleOn(true);
    const current = queue[currentTrackIndex];
    const past = queue.slice(0, currentTrackIndex);
    const upcoming = queue.slice(currentTrackIndex + 1);
    const shuffledUpcoming = shuffleArray(upcoming);

    setQueue([...past, current, ...shuffledUpcoming]);
    soundSystem.vibrate(20);
  };

  // Auto-advance when video finishes
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.event === 'onStateChange' && data?.info === 0) {
          // YT.PlayerState.ENDED (0) -> auto advance to next song in queue
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
  const handleAddCustomTrack = async (e: React.FormEvent, shouldShuffle = false) => {
    e.preventDefault();
    if (!customInputUrl.trim()) return;

    const parsed = parseYouTubeInput(customInputUrl, { autoplay: true, muted: false });
    if (!parsed.isValid) {
      setAddUrlError('Please enter a valid YouTube video or playlist URL.');
      return;
    }

    setAddUrlError(null);

    // If it is a playlist, fetch its actual queue of videos!
    if (parsed.playlistId) {
      setIsLoadingPlaylist(true);
      try {
        const res = await fetch(`/api/youtube/playlist?list=${encodeURIComponent(parsed.playlistId)}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          const playlistItems: QueueItem[] = data.items.map((it: any, index: number) => ({
            id: `pl-${parsed.playlistId}-${it.videoId}-${index}`,
            title: it.title || `Track ${index + 1}`,
            artist: it.artist || data.playlistTitle || 'Playlist',
            videoId: it.videoId,
            playlistId: parsed.playlistId || undefined,
          }));

          let finalQueue = playlistItems;
          let targetIndex = 0;

          if (shouldShuffle) {
            finalQueue = shuffleArray(playlistItems);
            setIsShuffleOn(true);
          } else if (parsed.videoId) {
            // If URL was a specific video in a playlist, start from that video
            const foundIdx = playlistItems.findIndex(it => it.videoId === parsed.videoId);
            if (foundIdx >= 0) targetIndex = foundIdx;
          }

          setQueue(finalQueue);
          setCurrentTrackIndex(targetIndex);
          setIsPlaying(true);

          setCustomInputUrl('');
          setCustomTitle('');
          setCustomArtist('');
          setIsAddModalOpen(false);
          setIsLoadingPlaylist(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to load playlist items via API:', err);
      } finally {
        setIsLoadingPlaylist(false);
      }
    }

    // Single video addition
    const newTrack: QueueItem = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim() || 'Custom Music Video',
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

      if (isArrivalsCollapsed) {
        setCollapsedArrivalToast(`${latestGuest.name || `Guest ${latestGuest.tag_id}`} just arrived!`);
        setTimeout(() => setCollapsedArrivalToast(null), 8000);
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
      className={`w-full h-screen max-h-screen ${themeClasses} transition-colors duration-300 flex flex-col p-2.5 sm:p-3.5 space-y-2.5 overflow-hidden`}
    >
      {/* ================================================================ */}
      {/* 1. UNIFIED TOP BAR: PROGRESS BAR + ATTENDANCE + STAGE CONTROLS   */}
      {/* ================================================================ */}
      <header
        className={`w-full rounded-2xl px-4 py-2 flex items-center justify-between gap-3 border ${cardThemeClasses} shrink-0`}
      >
        {/* Left: Party Program Progress Bar (Replaces Red TV Emoji & Thriller) */}
        <PartyProgressBar
          schedule={partySchedule}
          onOpenSettings={() => setIsScheduleModalOpen(true)}
          simulatedTime={simulatedTime}
          className="flex-1 min-w-0"
        />

        {/* Center / Right: Live Attendance Counter & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Discrete Now Playing Badge */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white max-w-[200px]">
            <Music2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{currentTrack.title}</span>
          </div>

          {/* Live Attendance Counter */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/[0.05] border border-white/10 text-white">
            <Users className="w-3.5 h-3.5 opacity-70" />
            <span className="font-display text-lg font-bold leading-none">
              {stats.totalEntered}
            </span>
            <span className="font-sans-clean text-xs opacity-50">
              / {stats.totalCapacity} inside
            </span>
          </div>

          {/* Split Ratio Selector */}
          <div className="hidden xl:flex items-center gap-0.5 p-0.5 rounded-xl bg-white/[0.05] border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setSplitRatio('65_35')}
              className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                splitRatio === '65_35' ? 'bg-white/20 font-black text-white' : 'opacity-60 hover:opacity-100 text-white'
              }`}
              title="65% Video / 35% Feed"
            >
              65:35
            </button>
            <button
              type="button"
              onClick={() => setSplitRatio('50_50')}
              className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                splitRatio === '50_50' ? 'bg-white/20 font-black text-white' : 'opacity-60 hover:opacity-100 text-white'
              }`}
              title="50% Video / 50% Feed"
            >
              50:50
            </button>
            <button
              type="button"
              onClick={() => setSplitRatio('75_25')}
              className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                splitRatio === '75_25' ? 'bg-white/20 font-black text-white' : 'opacity-60 hover:opacity-100 text-white'
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
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              playChimeOnArrival
                ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                : 'border-white/10 text-white opacity-60 hover:opacity-100'
            }`}
            title={playChimeOnArrival ? 'Arrival Chime Enabled' : 'Arrival Chime Muted'}
          >
            {playChimeOnArrival ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen Stage Mode */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 hover:bg-white/10 text-xs font-sans-clean font-bold tracking-wider lowercase transition-all cursor-pointer text-white"
            title="Expand to Fullscreen Projector Canvas"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'exit' : 'stage'}</span>
          </button>
        </div>
      </header>

      {/* ================================================================ */}
      {/* 2. DUAL SPLIT WORKSPACE: YOUTUBE MUSIC VIDEO + LIVE GUEST FEED    */}
      {/* ================================================================ */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 overflow-hidden">
        {/* ============================================================== */}
        {/* LEFT VIEW: YOUTUBE MUSIC VIDEO PLAYER + QUEUE WORKSPACE        */}
        {/* ============================================================== */}
        <section className={`flex flex-col gap-2 h-full min-h-0 ${splitClasses.video} transition-all duration-300`}>
          {/* Music Video Canvas */}
          <div
            className={`relative flex-1 min-h-0 rounded-2xl overflow-hidden border ${cardThemeClasses} flex flex-col`}
          >
            {/* Embedded YouTube Player */}
            <div className="relative flex-1 w-full h-full bg-black flex items-center justify-center min-h-0">
              <iframe
                ref={iframeRef}
                title="YouTube Music Video Player"
                src={activeEmbedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-none"
              />
            </div>

            {/* Playback Controls & Action Ribbon */}
            <div className="px-3.5 py-2 border-t border-white/10 flex items-center justify-between gap-3 bg-[#0a0a0a] shrink-0">
              {/* Transport Controls: Prev, Play/Pause, Next, Shuffle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevTrack}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95"
                  title="Previous Track"
                >
                  <SkipBack className="w-3.5 h-3.5 fill-white" />
                </button>

                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="p-2.5 rounded-full bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer active:scale-95 shadow-md"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-black ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95"
                  title="Next Track"
                >
                  <SkipForward className="w-3.5 h-3.5 fill-white" />
                </button>

                <button
                  type="button"
                  onClick={handleToggleShuffle}
                  className={`p-2 rounded-full transition-all cursor-pointer active:scale-95 ${
                    isShuffleOn
                      ? 'bg-amber-400 text-black font-bold shadow-md'
                      : 'bg-white/10 hover:bg-white/20 text-white opacity-70 hover:opacity-100'
                  }`}
                  title={isShuffleOn ? 'Shuffle Mode On' : 'Shuffle Queue'}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* High-Contrast "+ Add Video or Playlist" Button */}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-1.5 rounded-full font-sans-clean font-bold text-xs tracking-wider lowercase transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 bg-white text-black hover:bg-neutral-200 border border-white shadow-lg"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>add video or playlist</span>
              </button>
            </div>
          </div>

          {/* UP NEXT ON QUEUE BAR */}
          <div className={`p-2 px-3 rounded-xl border ${cardThemeClasses} shrink-0 space-y-1`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListMusic className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/90">
                  UP NEXT ({upcomingQueue.length})
                </span>
                {upcomingQueue.length > 1 && (
                  <button
                    type="button"
                    onClick={handleShuffleUpcomingQueue}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 font-mono text-[9px] font-bold transition-all cursor-pointer"
                    title="Randomly shuffle all upcoming songs in queue"
                  >
                    <Shuffle className="w-2.5 h-2.5" />
                    <span>shuffle</span>
                  </button>
                )}
              </div>
              <span className="font-mono text-[10px] text-white/50">
                Track {currentTrackIndex + 1} of {queue.length}
              </span>
            </div>

            {/* Upcoming Track Strip */}
            {upcomingQueue.length === 0 ? (
              <div className="py-1 text-xs text-white/40 font-sans-clean">
                End of queue reached. Click &quot;+ Add Video or Playlist&quot; to queue more.
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {upcomingQueue.map((track, relativeIdx) => {
                  const absoluteIdx = currentTrackIndex + 1 + relativeIdx;
                  return (
                    <div
                      key={track.id}
                      className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 flex items-center gap-2 shrink-0 transition-all group"
                    >
                      <button
                        type="button"
                        onClick={() => handlePlayQueueItem(absoluteIdx)}
                        className="text-left cursor-pointer max-w-[160px]"
                        title="Play Track Now"
                      >
                        <span className="font-sans-clean text-xs font-bold text-white block leading-tight group-hover:text-amber-300 truncate">
                          {track.title}
                        </span>
                        <span className="font-sans-clean text-[10px] text-white/50 block leading-tight mt-0.5 truncate">
                          {track.artist}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveTrack(absoluteIdx)}
                        className="p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-white/10 transition-colors ml-0.5 cursor-pointer"
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
        {/* RIGHT VIEW: LIVE FEED & LOUNGE DROPDOWN WIDGET                */}
        {/* ============================================================== */}
        <section className={`flex flex-col gap-4 ${splitClasses.feed} transition-all duration-300`}>
          <div className={`flex-1 rounded-3xl border ${cardThemeClasses} p-5 flex flex-col overflow-hidden`}>
            {/* 1. Interactive Dropdown Widget Header */}
            <div className="pb-3 border-b border-white/10 shrink-0 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold lowercase tracking-tight leading-none text-white truncate">
                    {isArrivalsCollapsed ? 'party lounge & games' : 'live guest arrivals'}
                  </h2>
                  {stats.totalEntered >= stats.totalCapacity && stats.totalCapacity > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold shrink-0">
                      🎉 all here
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="font-display text-xl sm:text-2xl font-bold leading-none text-white">
                      {stats.totalEntered}
                    </span>
                    <span className="font-sans-clean text-[10px] opacity-60 lowercase block">
                      / {stats.totalCapacity} inside
                    </span>
                  </div>

                  {/* Dropdown Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsArrivalsCollapsed(prev => !prev)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-sans-clean font-bold transition-all cursor-pointer hover:border-amber-400/50"
                    title={isArrivalsCollapsed ? 'Expand live arrivals stream' : 'Collapse feed to show poker table & party stats'}
                  >
                    {isArrivalsCollapsed ? (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">feed</span>
                      </>
                    ) : (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">collapse</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Mode & Tab Switcher Ribbon */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                <button
                  type="button"
                  onClick={() => setIsArrivalsCollapsed(false)}
                  className={`px-3 py-1 rounded-xl text-xs font-sans-clean font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    !isArrivalsCollapsed
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>arrivals feed</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsArrivalsCollapsed(true);
                    setActiveLoungeTab('poker');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-sans-clean font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isArrivalsCollapsed && activeLoungeTab === 'poker'
                      ? 'bg-amber-400 text-black shadow-sm font-extrabold'
                      : 'bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>poker table</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsArrivalsCollapsed(true);
                    setActiveLoungeTab('stats');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-sans-clean font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isArrivalsCollapsed && activeLoungeTab === 'stats'
                      ? 'bg-amber-400 text-black shadow-sm font-extrabold'
                      : 'bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>fun stats</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsArrivalsCollapsed(true);
                    setActiveLoungeTab('qrs');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-sans-clean font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isArrivalsCollapsed && activeLoungeTab === 'qrs'
                      ? 'bg-amber-400 text-black shadow-sm font-extrabold'
                      : 'bg-white/[0.05] text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>qr hub</span>
                </button>
              </div>

              {/* Collapsed Arrival Toast / Notification banner if new arrival occurs while collapsed */}
              {isArrivalsCollapsed && collapsedArrivalToast && (
                <div
                  onClick={() => setIsArrivalsCollapsed(false)}
                  className="p-2.5 rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-sans-clean flex items-center justify-between cursor-pointer animate-in fade-in slide-in-from-top-1"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                    <span className="truncate">{collapsedArrivalToast}</span>
                  </span>
                  <span className="text-[10px] font-mono underline shrink-0 ml-2">view feed ➔</span>
                </div>
              )}
            </div>

            {!isArrivalsCollapsed ? (
              // ==============================================================
              // VIEW A: EXPANDED LIVE GUEST ARRIVALS FEED
              // ==============================================================
              <>
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

                {/* Scrollable Guest Feed */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 my-1">
                  {enteredGuests.length === 0 ? (
                    <div className="h-40 flex flex-col items-center justify-center text-center p-4 space-y-2 opacity-60">
                      <DoorOpen className="w-7 h-7 opacity-40 text-white" />
                      <p className="font-sans-clean text-xs lowercase text-white/70">
                        Waiting for first guest admission...
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
                          className={`p-2.5 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3 ${
                            isNewArrival
                              ? 'border-amber-400 bg-amber-400/10 shadow-md'
                              : idx === 0
                              ? 'border-white/15 bg-white/[0.04]'
                              : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono text-xs font-bold text-white/70 w-12 text-left shrink-0">
                              {tagDisplay}
                            </span>
                            <div className="min-w-0">
                              <span className="font-display text-lg font-bold lowercase leading-tight text-white block truncate">
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

                {/* Everyone Arrived Suggestion Banner */}
                {stats.totalEntered >= stats.totalCapacity && stats.totalCapacity > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsArrivalsCollapsed(true)}
                    className="w-full mb-1 py-1.5 px-3 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-sans-clean font-bold flex items-center justify-center gap-1.5 hover:bg-amber-400/25 transition-all cursor-pointer shrink-0"
                  >
                    <span>Everyone arrived! Switch to Poker Table & Stats</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Footer with Instant Test Check-in */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs opacity-60 shrink-0">
                  <span className="font-sans-clean text-[11px] text-white/50">
                    Live Arrivals Stream
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
              </>
            ) : (
              // ==============================================================
              // VIEW B: COLLAPSED SPACE REPLACED WITH POKER & PARTY LOUNGE
              // ==============================================================
              <div className="flex-1 min-h-0 flex flex-col pt-2 overflow-y-auto animate-in fade-in duration-200">
                {activeLoungeTab === 'poker' && (
                  <PokerWidget onExpandFeed={() => setIsArrivalsCollapsed(false)} />
                )}
                {activeLoungeTab === 'stats' && (
                  <PartyFunStatsWidget guests={guests} />
                )}
                {activeLoungeTab === 'qrs' && (
                  <PartyQrHubWidget />
                )}
              </div>
            )}
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

            <form onSubmit={e => handleAddCustomTrack(e, false)} className="space-y-4">
              <div>
                <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                  YouTube Video or Playlist URL *
                </label>
                <input
                  type="text"
                  required
                  value={customInputUrl}
                  onChange={e => setCustomInputUrl(e.target.value)}
                  placeholder="https://www.youtube.com/playlist?list=... or watch?v=..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-sans-clean focus:outline-none focus:border-white"
                />
                <p className="text-[11px] text-white/50 mt-1">
                  Tip: Pasting a playlist URL loads all tracks directly into the &quot;Up Next&quot; queue!
                </p>
              </div>

              {!customInputUrl.includes('list=') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                      Song Title (optional)
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
                      Artist (optional)
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
              )}

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

                {customInputUrl.includes('list=') && (
                  <button
                    type="button"
                    disabled={isLoadingPlaylist}
                    onClick={e => handleAddCustomTrack(e, true)}
                    className="px-4 py-2 rounded-full text-xs font-sans-clean font-bold bg-amber-400 text-black hover:bg-amber-300 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    {isLoadingPlaylist ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Shuffle className="w-3.5 h-3.5" />
                    )}
                    <span>shuffle & play</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isLoadingPlaylist}
                  className="px-5 py-2 rounded-full text-xs font-sans-clean font-bold bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {isLoadingPlaylist ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>loading playlist...</span>
                    </>
                  ) : (
                    <span>{customInputUrl.includes('list=') ? 'load playlist queue' : 'add to queue'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 4. PARTY PROGRAM SCHEDULE MODAL                                  */}
      {/* ================================================================ */}
      <PartyScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        schedule={partySchedule}
        onSave={updated => {
          setPartySchedule(updated);
          savePartySchedule(updated);
        }}
        simulatedTime={simulatedTime}
        onSetSimulatedTime={setSimulatedTime}
      />
    </div>
  );
}
