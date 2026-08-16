import React from 'react';
import { ConnectionStatus } from '../services/binanceService';
import { SMCState, Timeframe } from '../types/smc';
import { Wifi, WifiOff, Clock, Shield, Layers, Zap, Terminal } from 'lucide-react';

interface BottomStatusBarProps {
  connectionStatus: ConnectionStatus;
  symbol: string;
  timeframe: Timeframe;
  smcState: SMCState;
  lastCandleTime: number;
  onToggleDebug: () => void;
  isDebugOpen: boolean;
}

export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
  connectionStatus,
  symbol,
  timeframe,
  smcState,
  lastCandleTime,
  onToggleDebug,
  isDebugOpen,
}) => {
  const activeOBCount = smcState.orderBlocks.filter(
    (o) => o.status === 'FRESH' || o.status === 'TESTED'
  ).length;
  const activeFVGCount = smcState.fvgs.filter(
    (f) => f.status === 'FRESH' || f.status === 'PARTIALLY_FILLED'
  ).length;

  return (
    <footer
      id="app-bottom-status-bar"
      className="h-7 bg-[#161a1e] border-t border-[#2b2f36] px-3 flex items-center justify-between text-[10px] text-[#848e9c] font-mono select-none z-20"
    >
      {/* Left status indicators */}
      <div className="flex items-center space-x-4">
        {/* Connection status */}
        <div className="flex items-center space-x-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus === 'CONNECTED'
                ? 'bg-[#2ebd85]'
                : connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING'
                ? 'bg-[#f0b90b] animate-pulse'
                : 'bg-[#f6465d]'
            }`}
          />
          <span className="text-[#b7bdc6]">
            Binance Live Feed ({symbol} {timeframe})
          </span>
        </div>

        {/* Last sync timestamp */}
        {lastCandleTime > 0 && (
          <div className="hidden sm:flex items-center space-x-1 text-[#5e6673]">
            <Clock className="w-3 h-3" />
            <span>
              Last Candle: {new Date(lastCandleTime * 1000).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Center / Right stats */}
      <div className="flex items-center space-x-4">
        {/* Active Structure */}
        <div className="flex items-center space-x-1">
          <Shield className="w-3 h-3 text-[#f0b90b]" />
          <span className="text-[#5e6673]">Bias:</span>
          <span
            className={`font-bold ${
              smcState.activeBias === 'BULLISH'
                ? 'text-[#2ebd85]'
                : smcState.activeBias === 'BEARISH'
                ? 'text-[#f6465d]'
                : 'text-[#848e9c]'
            }`}
          >
            {smcState.activeBias}
          </span>
        </div>

        {/* Active Zones */}
        <div className="hidden md:flex items-center space-x-3">
          <div>
            <span className="text-[#5e6673]">OBs: </span>
            <span className="text-white font-bold">{activeOBCount}</span>
          </div>
          <div>
            <span className="text-[#5e6673]">FVGs: </span>
            <span className="text-[#2ebd85] font-bold">{activeFVGCount}</span>
          </div>
          <div>
            <span className="text-[#5e6673]">Swings: </span>
            <span className="text-[#f0b90b] font-bold">{smcState.swings.length}</span>
          </div>
        </div>

        {/* Debug console trigger */}
        <button
          onClick={onToggleDebug}
          className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border transition-colors ${
            isDebugOpen
              ? 'bg-[#f0b90b]/15 border-[#f0b90b] text-[#f0b90b]'
              : 'bg-[#1e2329] border-[#2b2f36] hover:border-[#474d57] text-[#848e9c] hover:text-white'
          }`}
        >
          <Terminal className="w-3 h-3" />
          <span>Telemetry</span>
        </button>
      </div>
    </footer>
  );
};
