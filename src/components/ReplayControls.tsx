import React, { useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  FastForward,
  Eye,
  Sliders,
} from 'lucide-react';

interface ReplayControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentIndex: number;
  totalCandles: number;
  onStepForward: () => void;
  onStepBackward: () => void;
  onReset: () => void;
  onSeek: (index: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onExit: () => void;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  isPlaying,
  onTogglePlay,
  currentIndex,
  totalCandles,
  onStepForward,
  onStepBackward,
  onReset,
  onSeek,
  speed,
  onSpeedChange,
  onExit,
}) => {
  const speeds = [0.5, 1, 2, 5, 10];

  return (
    <div
      id="replay-control-bar"
      className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-[#161a1e] border border-[#f0b90b] rounded-lg shadow-2xl px-4 py-2 flex items-center space-x-3 text-[#b7bdc6] z-40 select-none font-sans"
    >
      {/* Replay Mode Indicator Badge */}
      <div className="flex items-center space-x-2 pr-3 border-r border-[#2b2f36]">
        <span className="w-2 h-2 rounded-full bg-[#f0b90b] animate-ping" />
        <div>
          <span className="font-bold text-[11px] text-[#f0b90b] uppercase tracking-wider block">
            Bar Replay Engine
          </span>
          <span className="text-[9px] text-[#848e9c] font-mono">
            Bar {currentIndex + 1} of {totalCandles}
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center space-x-1">
        <button
          id="btn-replay-reset"
          onClick={onReset}
          className="p-1.5 rounded bg-[#1e2329] border border-[#2b2f36] text-[#848e9c] hover:text-white hover:bg-[#2b2f36] transition-colors"
          title="Reset to Start"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          id="btn-replay-step-back"
          onClick={onStepBackward}
          disabled={currentIndex <= 20}
          className="p-1.5 rounded bg-[#1e2329] border border-[#2b2f36] text-[#848e9c] hover:text-white hover:bg-[#2b2f36] disabled:opacity-30 transition-colors"
          title="Step Backward (1 Bar)"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        <button
          id="btn-replay-play-pause"
          onClick={onTogglePlay}
          className="p-2 rounded bg-[#f0b90b] hover:bg-[#fcd535] text-[#0b0e11] font-bold shadow transition-all"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        </button>

        <button
          id="btn-replay-step-forward"
          onClick={onStepForward}
          disabled={currentIndex >= totalCandles - 1}
          className="p-1.5 rounded bg-[#1e2329] border border-[#2b2f36] text-[#848e9c] hover:text-white hover:bg-[#2b2f36] disabled:opacity-30 transition-colors"
          title="Step Forward (1 Bar)"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrubber slider */}
      <div className="flex items-center space-x-2 w-44">
        <input
          id="replay-slider"
          type="range"
          min="20"
          max={totalCandles - 1}
          value={currentIndex}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full accent-[#f0b90b] cursor-pointer"
        />
      </div>

      {/* Speed Selector */}
      <div className="flex items-center bg-[#0b0e11] rounded p-0.5 border border-[#2b2f36] text-[10px] font-mono">
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-1.5 py-0.5 rounded transition-all ${
              speed === s ? 'bg-[#2b2f36] text-[#f0b90b] font-bold' : 'text-[#848e9c] hover:text-white'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Exit Button */}
      <button
        id="btn-replay-exit"
        onClick={onExit}
        className="text-[10px] px-2 py-1 rounded bg-[#1e2329] border border-[#2b2f36] hover:bg-[#2b2f36] text-white font-semibold transition-colors"
      >
        Exit
      </button>
    </div>
  );
};
