import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX,
  Maximize, Minimize, Settings, Tv
} from 'lucide-react';
import { cn } from '../../utils';

interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
}

interface TrilezaVideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  progressBarColor?: string; // Tailwind bg class or inline color, e.g., 'bg-emerald-500'
  playPauseColor?: string;   // Tailwind text class, e.g., 'text-emerald-500'
  timeLabelColor?: string;   // Tailwind text class, e.g., 'text-slate-350'
  showNativeControls?: boolean;
  onEnded?: () => void;
  autoPlay?: boolean;
}

export const TrilezaVideoPlayer: React.FC<TrilezaVideoPlayerProps> = ({
  src,
  title = 'Course Lesson',
  poster,
  progressBarColor = 'bg-emerald-500',
  playPauseColor = 'text-white hover:text-emerald-400',
  timeLabelColor = 'text-slate-300',
  showNativeControls = false,
  onEnded,
  autoPlay = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Player States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [canPlay, setCanPlay] = useState(false); // true once first frame is ready
  
  // Custom Overrides/Controls
  const [showControls, setShowControls] = useState(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 is Auto
  
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [iframeUrl, setIframeUrl] = useState('');
  const controlsTimeoutRef = useRef<number | null>(null);

  // Extract Bunny Video ID from any URL
  const extractBunnyVideoId = (urlStr: string): string | null => {
    if (!urlStr) return null;
    const guidMatch = urlStr.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    return guidMatch ? guidMatch[0] : null;
  };

  // Initialize HLS / Video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!src) return;

    // Reset state when src changes
    setCanPlay(false);
    setDuration(0);
    setCurrentTime(0);
    setBuffered(0);
    setUseIframeFallback(false);
    setIframeUrl('');

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Check if src is directly a Bunny iframe embed
    if (src.includes('iframe.mediadelivery.net')) {
      setIframeUrl(src);
      setUseIframeFallback(true);
      setCanPlay(true);
      return;
    }

    // Timer fallback: If HLS doesn't load within 3.5 seconds, switch to Bunny iframe embed seamlessly
    const fallbackTimer = setTimeout(() => {
      if (!canPlay && video) {
        const vid = extractBunnyVideoId(src);
        if (vid) {
          console.log('[TrilezaVideoPlayer] HLS load stalled, switching to Bunny Stream iframe embed for video:', vid);
          setIframeUrl(`https://iframe.mediadelivery.net/embed/711161/${vid}?autoplay=${autoPlay ? 'true' : 'false'}&loop=false&muted=false&preload=true`);
          setUseIframeFallback(true);
          setCanPlay(true);
        }
      }
    }, 3500);

    if (src.endsWith('.m3u8') || src.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          // VOD-optimized settings — lowLatencyMode MUST be false for pre-recorded VOD
          lowLatencyMode: false,
          // Start prefetching first fragment before play is called
          startFragPrefetch: true,
          // Buffer goal: 20s ahead for VOD
          maxBufferLength: 20,
          maxMaxBufferLength: 30,
          backBufferLength: 30,
          // Max buffer size in bytes (~30MB)
          maxBufferSize: 30 * 1000 * 1000,
          // Assume 5Mbps initial bandwidth
          abrEwmaDefaultEstimate: 5_000_000,
          abrBandWidthFactor: 0.95,
          abrBandWidthUpFactor: 0.7,
          fragLoadingRetryDelay: 500,
          manifestLoadingRetryDelay: 500,
          // Ensure CORS requests work properly with Bunny CDN (no credentials header mismatch)
          xhrSetup: (xhr: XMLHttpRequest) => {
            xhr.withCredentials = false;
          },
        });
        hlsRef.current = hls;

        hls.loadSource(src);
        if (video) hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          setCanPlay(true);
          clearTimeout(fallbackTimer);
          const levels = data.levels.map((level, idx) => ({
            index: idx,
            height: level.height,
            bitrate: level.bitrate
          }));
          setQualityLevels(levels);
          if (autoPlay && video) {
            video.play().catch(() => {});
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, () => {
          setCurrentQuality(hls.loadLevel);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.warn('[TrilezaVideoPlayer] HLS Fatal Error:', data.type, data.details);
            clearTimeout(fallbackTimer);
            
            // On fatal error, seamlessly switch to Bunny iframe embed or direct MP4
            const vid = extractBunnyVideoId(src);
            if (vid) {
              setIframeUrl(`https://iframe.mediadelivery.net/embed/711161/${vid}?autoplay=${autoPlay ? 'true' : 'false'}&loop=false&muted=false&preload=true`);
              setUseIframeFallback(true);
              setCanPlay(true);
            } else if (video) {
              // Direct MP4 fallback attempt
              const mp4FallbackUrl = src.replace('/playlist.m3u8', '/play_720p.mp4');
              video.src = mp4FallbackUrl;
              video.load();
              if (autoPlay) video.play().catch(() => {});
            }
          }
        });
      } else if (video && video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari/iOS)
        video.src = src;
        video.load();
        if (autoPlay) video.play().catch(() => {});
      }
    } else if (video) {
      // Normal MP4/WebM
      video.src = src;
      video.load();
      if (autoPlay) video.play().catch(() => {});
    }

    // Media Session (lock screen controls)
    if ('mediaSession' in navigator && video) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: 'Trileza Academy',
        album: 'E-Learning Program',
        artwork: poster ? [{ src: poster, sizes: '512x512', type: 'image/png' }] : []
      });
      navigator.mediaSession.setActionHandler('play', () => video.play());
      navigator.mediaSession.setActionHandler('pause', () => video.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        video.currentTime = Math.max(0, video.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
      });
    }

    return () => {
      clearTimeout(fallbackTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, title, poster, autoPlay]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        const lastBuffer = video.buffered.end(video.buffered.length - 1);
        setBuffered(lastBuffer);
      }
    };
    const handleDurationChange = () => {
      if (!isNaN(video.duration)) setDuration(video.duration);
    };
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      if (onEnded) onEnded();
    };
    // canplay fires as soon as the browser has enough data to start — much
    // earlier than when duration becomes known, so the loading overlay clears fast.
    const handleCanPlay = () => setCanPlay(true);
    // Also clear on loadedmetadata so duration shows early
    const handleLoadedMetadata = () => {
      if (!isNaN(video.duration)) setDuration(video.duration);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [onEnded]);

  // Keyboard navigation & accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      // Do not trigger hotkeys if typing in an input or textarea
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Controls auto-hide logic
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Player controls wrappers
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
    handleMouseMove();
  };

  const seekRelative = (amount: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + amount));
    handleMouseMove();
  };

  const handleProgressBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const value = parseFloat(e.target.value);
    video.currentTime = (value / 100) * (video.duration || 0);
    setCurrentTime(video.currentTime);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const value = parseFloat(e.target.value);
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setIsMuted(video.muted);
  };

  const adjustVolume = (amount: number) => {
    const video = videoRef.current;
    if (!video) return;
    const newVol = Math.max(0, Math.min(1, video.volume + amount));
    video.volume = newVol;
    video.muted = newVol === 0;
  };

  const handleSpeedChange = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettingsMenu(false);
  };

  const handleQualityChange = (index: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
      setCurrentQuality(index);
    }
    setShowSettingsMenu(false);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Fullscreen failed:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.error('PiP failed:', err);
    }
  };

  // Helper formatting for time (e.g. 02:45)
  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs)) return '00:00';
    const hrs = Math.floor(timeInSecs / 3600);
    const mins = Math.floor((timeInSecs % 3600) / 60);
    const secs = Math.floor(timeInSecs % 60);
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const percentProgress = duration ? (currentTime / duration) * 100 : 0;
  const percentBuffered = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full aspect-video bg-black overflow-hidden select-none group font-sans border border-slate-800",
        isFullscreen ? "rounded-none" : "rounded-3xl"
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Bunny Stream Iframe Fallback element */}
      {useIframeFallback && iframeUrl ? (
        <iframe
          src={iframeUrl}
          className="w-full h-full border-0 absolute inset-0 z-0 bg-black"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          onLoad={() => setCanPlay(true)}
        />
      ) : (
        /* Actual HTML5 Video element */
        <video
          ref={videoRef}
          poster={poster}
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          controls={showNativeControls}
          onClick={togglePlay}
          className="w-full h-full object-contain cursor-pointer"
        />
      )}

      {/* Loading Overlay — shown until canplay fires for HTML5 video */}
      {!useIframeFallback && !canPlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-10 backdrop-blur-sm transition-opacity duration-300">
          {/* Poster thumbnail behind spinner for instant visual feedback */}
          {poster && (
            <img
              src={poster}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-20"
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <div className="absolute inset-0 border-[3px] border-slate-700 rounded-full" />
              <div className="absolute inset-0 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <Tv className="text-emerald-400" size={20} />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-300">Loading Video</p>
              <p className="text-[10px] text-slate-500 mt-1">Trileza · HLS Stream</p>
            </div>
          </div>
        </div>
      )}

      {/* Custom Branded Playback Controls Overlay — ONLY for HTML5 Video */}
      {!useIframeFallback && !showNativeControls && (
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent transition-opacity duration-300 z-20 p-4 md:p-6",
            showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
        >
          {/* Top Video Title bar */}
          <div className="absolute top-6 left-6 right-6 hidden md:flex items-center justify-between text-white drop-shadow-md">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/50 px-2.5 py-1.5 rounded-full border border-emerald-800/35 backdrop-blur-md">Trileza Custom Player</span>
              <h3 className="text-base font-black tracking-tight mt-2">{title}</h3>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-900/60 p-2 rounded-xl border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>HLS Streaming</span>
            </div>
          </div>

          {/* Controls Container */}
          <div className="space-y-4 max-w-full drop-shadow-lg">
            {/* Progress Bar & Slider */}
            <div className="relative w-full group/slider flex items-center h-6 cursor-pointer">
              {/* Virtual Tracks */}
              <div className="absolute inset-x-0 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                {/* Buffered track */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-slate-600/50 rounded-full transition-all duration-200"
                  style={{ width: `${percentBuffered}%` }}
                />
                {/* Played track */}
                <div
                  className={cn("absolute top-0 bottom-0 left-0 rounded-full", progressBarColor)}
                  style={{ width: `${percentProgress}%` }}
                />
              </div>

              {/* HTML5 Range Input Slider (Invisible but interactive) */}
              <input
                type="range"
                min="0"
                max="100"
                step="0.01"
                value={percentProgress}
                onChange={handleProgressBarChange}
                className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-30"
                aria-label="Video progression slider"
              />

              {/* Progress Knob */}
              <div
                className="absolute w-3.5 h-3.5 bg-white rounded-full border-2 border-emerald-500 shadow-md transform -translate-x-1/2 scale-0 group-hover/slider:scale-100 transition-all duration-150 z-20 pointer-events-none"
                style={{ left: `${percentProgress}%` }}
              />
            </div>

            {/* Buttons Row */}
            <div className="flex items-center justify-between gap-4 text-white">
              {/* Left Side Controls (Play, Seek, Volume, Time) */}
              <div className="flex items-center gap-4">
                {/* Play/Pause Button */}
                <button
                  type="button"
                  onClick={togglePlay}
                  className={cn("focus:outline-none transition-all p-1 hover:scale-115 active:scale-90 border-none bg-transparent", playPauseColor)}
                  aria-label={isPlaying ? 'Pause video' : 'Play video'}
                >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                </button>

                {/* Seek Back 10s */}
                <button
                  type="button"
                  onClick={() => seekRelative(-10)}
                  className="text-slate-400 hover:text-white transition-colors focus:outline-none border-none bg-transparent"
                  aria-label="Rewind 10 seconds"
                >
                  <RotateCcw size={16} />
                </button>

                {/* Seek Forward 10s */}
                <button
                  type="button"
                  onClick={() => seekRelative(10)}
                  className="text-slate-400 hover:text-white transition-colors focus:outline-none border-none bg-transparent"
                  aria-label="Fast forward 10 seconds"
                >
                  <RotateCw size={16} />
                </button>

                {/* Volume Section */}
                <div className="flex items-center gap-2 group/volume">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="text-slate-400 hover:text-white transition-colors focus:outline-none border-none bg-transparent"
                    aria-label={isMuted ? 'Unmute volume' : 'Mute volume'}
                  >
                    {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeSliderChange}
                    className="w-0 overflow-hidden group-hover/volume:w-16 focus/volume:w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer transition-all duration-300 accent-emerald-500"
                    aria-label="Volume slider"
                  />
                </div>

                {/* Time Indicators */}
                <div className={cn("text-xs font-black tracking-wider uppercase ml-1", timeLabelColor)}>
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-slate-600 mx-1.5">/</span>
                  <span className="text-slate-400">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Side Controls (Speed, Quality, PiP, Fullscreen) */}
              <div className="flex items-center gap-4 relative">
                {/* Settings Menu trigger */}
                <button
                  type="button"
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className={cn(
                    "text-slate-400 hover:text-white transition-colors focus:outline-none border-none bg-transparent",
                    showSettingsMenu && "text-emerald-400 rotate-45"
                  )}
                  aria-label="Settings configuration"
                >
                  <Settings size={18} />
                </button>

                {/* Dynamic Quality / Speed Menu Overlay */}
                {showSettingsMenu && (
                  <div className="absolute bottom-10 right-0 w-48 bg-slate-950/95 border border-slate-800 rounded-2xl p-4 shadow-2xl z-50 text-left text-xs text-white space-y-4 backdrop-blur-xl animate-in slide-in-from-bottom-3 duration-200">
                    {/* Playback speed section */}
                    <div className="space-y-2">
                      <h4 className="font-black uppercase tracking-wider text-slate-500 text-[9px]">Speed</h4>
                      <div className="grid grid-cols-3 gap-1">
                        {[0.5, 1, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => handleSpeedChange(rate)}
                            className={cn(
                              "py-1 rounded-lg border text-[10px] font-black",
                              playbackRate === rate
                                ? "bg-emerald-605 border-emerald-550 text-white"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-white"
                            )}
                          >
                            {rate === 1 ? '1.0x' : `${rate}x`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hls.js quality levels */}
                    {qualityLevels.length > 0 && (
                      <div className="space-y-2 border-t border-slate-900 pt-3">
                        <h4 className="font-black uppercase tracking-wider text-slate-500 text-[9px]">Quality</h4>
                        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                          <button
                            onClick={() => handleQualityChange(-1)}
                            className={cn(
                              "text-left py-1.5 px-3 rounded-lg border text-[10px] font-black w-full flex items-center justify-between",
                              currentQuality === -1
                                ? "bg-emerald-600 border-emerald-500 text-white"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-white"
                            )}
                          >
                            <span>Auto</span>
                            {currentQuality === -1 && <span className="text-[9px] font-black uppercase text-emerald-350">active</span>}
                          </button>
                          {qualityLevels.map((lvl) => (
                            <button
                              key={lvl.index}
                              onClick={() => handleQualityChange(lvl.index)}
                              className={cn(
                                "text-left py-1.5 px-3 rounded-lg border text-[10px] font-black w-full flex items-center justify-between",
                                currentQuality === lvl.index
                                  ? "bg-emerald-600 border-emerald-500 text-white"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-white"
                              )}
                            >
                              <span>{lvl.height}p</span>
                              {currentQuality === lvl.index && <span className="text-[9px] font-black uppercase text-emerald-350">active</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Picture in Picture */}
                {document.pictureInPictureEnabled && (
                  <button
                    type="button"
                    onClick={togglePiP}
                    className="text-slate-400 hover:text-white transition-colors focus:outline-none border-none bg-transparent"
                    aria-label="Picture in Picture"
                  >
                    <Tv size={18} />
                  </button>
                )}

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="text-slate-400 hover:text-white transition-colors focus:outline-none border-none bg-transparent"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
