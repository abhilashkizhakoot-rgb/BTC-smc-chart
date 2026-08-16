import React from 'react';
import { Timeframe } from '../types/smc';
import { Ticker24h, ConnectionStatus } from '../services/binanceService';
import {
  Activity,
  PlayCircle,
  CheckCircle2,
  Sliders,
  Terminal,
  Wifi,
  WifiOff,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react';

interface TopBarProps {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  ticker: Ticker24h | null;
  connectionStatus: ConnectionStatus;
  isReplayMode: boolean;
  onToggleReplay: () => void;
  onOpenTestSuite: () => void;
  onToggleSettings: () => void;
  onToggleDebug: () => void;
  isDebugOpen: boolean;
}

const SYMBOLS = [
  { id: 'BTCUSDT', label: 'BTC/USDT', name: 'Bitcoin' },
  { id: 'ETHUSDT', label: 'ETH/USDT', name: 'Ethereum' },
  { id: 'SOLUSDT', label: 'SOL/USDT', name: 'Solana' },
  { id: 'BNBUSDT', label: 'BNB/USDT', name: 'BNB' },
];

const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: '1m', label: '1m' },
  { id: '3m', label: '3m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '30m', label: '30m' },
  { id: '1h', label: '1h' },
  { id: '4h', label: '4h' },
  { id: '1d', label: '1D' },
];

export const TopBar: React.FC<TopBarProps> = ({
  symbol,
  onSymbolChange,
  timeframe,
  onTimeframeChange,
  ticker,
  connectionStatus,
  isReplayMode,
  onToggleReplay,
  onOpenTestSuite,
  onToggleSettings,
  onToggleDebug,
  isDebugOpen,
}) => {
  const isPositive = ticker ? ticker.priceChangePercent >= 0 : true;

  return (
    <header
      id="app-top-bar"
      className="h-12 bg-[#161a1e] border-b border-[#2b2f36] px-4 flex items-center justify-between text-[#b7bdc6] select-none z-30 font-sans"
    >
      {/* Left section: Logo & Symbol selector & Timeframes */}
      <div className="flex items-center space-x-4">
        {/* Brand & Market Identity */}
        <div className="flex items-center space-x-2.5 pr-3 border-r border-[#2b2f36]">
          <div className="w-7 h-7 rounded bg-[#2b2f36] border border-[#474d57] flex items-center justify-center text-[#f0b90b]">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm tracking-tight text-white">
                SMC Terminal
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#2b2f36] text-[#f0b90b] font-mono text-[9px] font-bold uppercase">
                PRO
              </span>
            </div>
          </div>
        </div>

        {/* Symbol Selector Dropdown */}
        <div className="relative group">
          <select
            id="symbol-select"
            value={symbol}
            onChange={(e) => onSymbolChange(e.target.value)}
            className="appearance-none bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] text-white text-xs font-bold rounded pl-2.5 pr-7 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#f0b90b]"
          >
            {SYMBOLS.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#1e2329] text-white">
                {s.label} ({s.name})
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#848e9c] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Timeframe Buttons */}
        <div
          id="timeframe-buttons"
          className="flex items-center space-x-1"
        >
          {TIMEFRAMES.map((tf) => {
            const isActive = timeframe === tf.id;
            return (
              <button
                key={tf.id}
                id={`tf-btn-${tf.id}`}
                onClick={() => onTimeframeChange(tf.id)}
                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                  isActive
                    ? 'bg-[#2b2f36] text-[#f0b90b] font-bold'
                    : 'text-[#848e9c] hover:bg-[#2b2f36] hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>

        {/* Live Ticker Snapshot */}
        {ticker && (
          <div className="hidden lg:flex items-center space-x-4 pl-4 border-l border-[#2b2f36] font-mono text-xs">
            <div className="flex flex-col">
              <span
                className={`text-sm font-semibold leading-tight ${
                  isPositive ? 'text-[#2ebd85]' : 'text-[#f6465d]'
                }`}
              >
                ${ticker.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span
                className={`text-[10px] leading-tight flex items-center ${
                  isPositive ? 'text-[#2ebd85]' : 'text-[#f6465d]'
                }`}
              >
                {isPositive ? '+' : ''}
                {ticker.priceChangePercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex space-x-3 text-[10px] text-[#848e9c]">
              <div>
                <span className="text-[#5e6673] mr-1">24h H</span>
                <span className="text-gray-300">${ticker.highPrice.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[#5e6673] mr-1">24h L</span>
                <span className="text-gray-300">${ticker.lowPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right section: Replay, Tests, Settings, Live Status */}
      <div className="flex items-center space-x-2">
        {/* Replay Mode Toggle */}
        <button
          id="btn-toggle-replay"
          onClick={onToggleReplay}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
            isReplayMode
              ? 'bg-[#f0b90b]/15 border-[#f0b90b] text-[#f0b90b]'
              : 'bg-[#1e2329] border-[#2b2f36] hover:border-[#474d57] text-[#b7bdc6] hover:text-white'
          }`}
        >
          <PlayCircle className={`w-3.5 h-3.5 ${isReplayMode ? 'text-[#f0b90b]' : 'text-[#848e9c]'}`} />
          <span>{isReplayMode ? 'Exit Replay' : 'Bar Replay'}</span>
        </button>

        {/* Test Suite Runner */}
        <button
          id="btn-open-tests"
          onClick={onOpenTestSuite}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] text-[#b7bdc6] hover:text-white transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-[#2ebd85]" />
          <span className="hidden sm:inline">Unit Tests</span>
        </button>

        {/* Debug Terminal Toggle */}
        <button
          id="btn-toggle-debug"
          onClick={onToggleDebug}
          className={`p-1.5 rounded border text-xs transition-colors ${
            isDebugOpen
              ? 'bg-[#f0b90b]/15 border-[#f0b90b] text-[#f0b90b]'
              : 'bg-[#1e2329] border-[#2b2f36] hover:border-[#474d57] text-[#848e9c] hover:text-white'
          }`}
          title="Toggle SMC Engine Debug Telemetry"
        >
          <Terminal className="w-3.5 h-3.5" />
        </button>

        {/* Indicator Settings Toggle */}
        <button
          id="btn-toggle-settings"
          onClick={onToggleSettings}
          className="bg-[#f0b90b] text-[#0b0e11] px-3 py-1 rounded text-xs font-bold hover:bg-[#f8d33a] transition-colors flex items-center space-x-1"
          title="SMC Settings & Toggles"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline uppercase">Indicators</span>
        </button>

        {/* Binance WebSocket Connection status */}
        <div
          id="ws-status-indicator"
          className="flex items-center space-x-1.5 px-2 py-1 rounded text-xs bg-[#1e2329] border border-[#2b2f36]"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === 'CONNECTED'
                ? 'bg-[#2ebd85]'
                : connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING'
                ? 'bg-[#f0b90b] animate-pulse'
                : 'bg-[#f6465d]'
            }`}
          />
          <span className="text-[#848e9c] uppercase text-[10px] tracking-tight font-medium hidden md:inline">
            {connectionStatus === 'CONNECTED'
              ? 'Connected'
              : connectionStatus === 'RECONNECTING'
              ? 'Reconnecting'
              : connectionStatus}
          </span>
        </div>
      </div>
    </header>
  );
};
