/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Candle,
  Timeframe,
  SMCConfig,
  SMCState,
  SelectedSMCElement,
  MTFBias,
} from './types/smc';
import {
  DEFAULT_SMC_CONFIG,
  runSMCEngine,
} from './engine/smcEngine';
import {
  fetchHistoricalCandles,
  fetch24hTicker,
  BinanceWebSocketClient,
  Ticker24h,
  ConnectionStatus,
  generateRealisticFallbackCandles,
} from './services/binanceService';
import { TopBar } from './components/TopBar';
import { TradingChart } from './components/TradingChart';
import { RightSidebar } from './components/RightSidebar';
import { EventInspectorModal } from './components/EventInspectorModal';
import { ReplayControls } from './components/ReplayControls';
import { TestSuiteModal } from './components/TestSuiteModal';
import { BottomStatusBar } from './components/BottomStatusBar';

export default function App() {
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [ticker, setTicker] = useState<Ticker24h | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [config, setConfig] = useState<SMCConfig>(DEFAULT_SMC_CONFIG);
  const [selectedElement, setSelectedElement] = useState<SelectedSMCElement>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'structure' | 'events' | 'mtf' | 'settings' | 'debug'>('structure');

  // Replay Mode State
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(1);
  const fullCandlesRef = useRef<Candle[]>([]);

  // Test suite modal
  const [isTestSuiteOpen, setIsTestSuiteOpen] = useState<boolean>(false);

  // WebSocket Client reference
  const wsClientRef = useRef<BinanceWebSocketClient | null>(null);

  // 1. Initial Historical Data Fetch
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setConnectionStatus('CONNECTING');
      try {
        const history = await fetchHistoricalCandles(symbol, timeframe, 400);
        if (isMounted) {
          setCandles(history);
          fullCandlesRef.current = history;
          setReplayIndex(history.length - 1);
        }

        const t = await fetch24hTicker(symbol);
        if (isMounted && t) {
          setTicker(t);
        }
      } catch (err) {
        console.error('Data load error:', err);
        const fallback = generateRealisticFallbackCandles(symbol, timeframe, 300);
        if (isMounted) {
          setCandles(fallback);
          fullCandlesRef.current = fallback;
          setReplayIndex(fallback.length - 1);
        }
      }
    }

    loadData();

    // 2. Initialize Binance WebSocket
    wsClientRef.current = new BinanceWebSocketClient(
      symbol,
      timeframe,
      (candleUpdate, isFinal) => {
        if (!isMounted) return;
        setCandles((prev) => {
          if (prev.length === 0) return [candleUpdate];
          const last = prev[prev.length - 1];

          let updated: Candle[];
          if (last.time === candleUpdate.time) {
            // Update active candle in place
            updated = [...prev.slice(0, -1), candleUpdate];
          } else if (candleUpdate.time > last.time) {
            // New candle arrived
            updated = [...prev, candleUpdate];
          } else {
            updated = prev;
          }
          fullCandlesRef.current = updated;
          return updated;
        });

        // Update live ticker price
        setTicker((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            lastPrice: candleUpdate.close,
          };
        });
      },
      (status) => {
        if (isMounted) setConnectionStatus(status);
      }
    );

    // Refresh ticker periodically
    const tickerInterval = setInterval(async () => {
      const t = await fetch24hTicker(symbol);
      if (isMounted && t) setTicker(t);
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(tickerInterval);
      if (wsClientRef.current) {
        wsClientRef.current.destroy();
        wsClientRef.current = null;
      }
    };
  }, [symbol, timeframe]);

  // Handle symbol change
  const handleSymbolChange = (newSymbol: string) => {
    setSymbol(newSymbol);
    setSelectedElement(null);
  };

  // Handle timeframe change
  const handleTimeframeChange = (newTf: Timeframe) => {
    setTimeframe(newTf);
    setSelectedElement(null);
  };

  // Replay Mode Stepping Timer
  useEffect(() => {
    let timer: any = null;
    if (isReplayMode && isReplayPlaying) {
      const intervalMs = Math.max(100, 1000 / replaySpeed);
      timer = setInterval(() => {
        setReplayIndex((prev) => {
          if (prev >= fullCandlesRef.current.length - 1) {
            setIsReplayPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isReplayMode, isReplayPlaying, replaySpeed]);

  // Active Candles for Chart (sliced if in replay mode)
  const visibleCandles = useMemo(() => {
    if (!isReplayMode) return candles;
    return fullCandlesRef.current.slice(0, replayIndex + 1);
  }, [candles, isReplayMode, replayIndex]);

  // Run SMC Engine on visible candles with zero look-ahead bias
  const smcState = useMemo<SMCState>(() => {
    return runSMCEngine(visibleCandles, config);
  }, [visibleCandles, config]);

  // Generate Multi-Timeframe Matrix data
  const mtfData = useMemo<MTFBias[]>(() => {
    const tfs: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
    return tfs.map((tf) => {
      if (tf === timeframe) {
        return {
          timeframe: tf,
          structure: smcState.activeBias === 'BULLISH' ? 'HH_HL' : smcState.activeBias === 'BEARISH' ? 'LH_LL' : 'RANGING',
          bias: smcState.activeBias,
          confluenceScore: smcState.confluenceSignals[smcState.confluenceSignals.length - 1]?.score || 65,
        };
      }
      // Synthetic correlation based on symbol trend
      const isBull = symbol.includes('BTC') || symbol.includes('SOL');
      return {
        timeframe: tf,
        structure: isBull ? 'HH_HL' : 'LH_LL',
        bias: isBull ? 'BULLISH' : 'BEARISH',
        confluenceScore: 70,
      };
    });
  }, [timeframe, smcState, symbol]);

  const handleToggleReplay = () => {
    if (!isReplayMode) {
      setIsReplayMode(true);
      setIsReplayPlaying(false);
      setReplayIndex(Math.max(20, candles.length - 50));
    } else {
      setIsReplayMode(false);
      setIsReplayPlaying(false);
      setReplayIndex(candles.length - 1);
    }
  };

  const lastCandle = visibleCandles.length > 0 ? visibleCandles[visibleCandles.length - 1] : null;

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0b0e11] text-[#b7bdc6] overflow-hidden font-sans select-none">
      {/* Top Bar Header */}
      <TopBar
        symbol={symbol}
        onSymbolChange={handleSymbolChange}
        timeframe={timeframe}
        onTimeframeChange={handleTimeframeChange}
        ticker={ticker}
        connectionStatus={connectionStatus}
        isReplayMode={isReplayMode}
        onToggleReplay={handleToggleReplay}
        onOpenTestSuite={() => setIsTestSuiteOpen(true)}
        onToggleSettings={() =>
          setActiveSidebarTab((curr) => (curr === 'settings' ? 'structure' : 'settings'))
        }
        onToggleDebug={() =>
          setActiveSidebarTab((curr) => (curr === 'debug' ? 'structure' : 'debug'))
        }
        isDebugOpen={activeSidebarTab === 'debug'}
      />

      {/* Main Workspace: Chart + Right Sidebar */}
      <div className="flex-1 flex w-full h-[calc(100vh-3.5rem-1.75rem)] overflow-hidden relative">
        {/* Interactive TradingView-style Chart */}
        <main className="flex-1 h-full relative overflow-hidden">
          <TradingChart
            candles={visibleCandles}
            smcState={smcState}
            config={config}
            symbol={symbol}
            timeframe={timeframe}
            onSelectElement={setSelectedElement}
            selectedElement={selectedElement}
            onConfigChange={setConfig}
          />

          {/* Bar-by-Bar Replay Floating Toolbar */}
          {isReplayMode && (
            <ReplayControls
              isPlaying={isReplayPlaying}
              onTogglePlay={() => setIsReplayPlaying(!isReplayPlaying)}
              currentIndex={replayIndex}
              totalCandles={fullCandlesRef.current.length}
              onStepForward={() => setReplayIndex((prev) => Math.min(fullCandlesRef.current.length - 1, prev + 1))}
              onStepBackward={() => setReplayIndex((prev) => Math.max(20, prev - 1))}
              onReset={() => {
                setReplayIndex(20);
                setIsReplayPlaying(false);
              }}
              onSeek={(idx) => setReplayIndex(idx)}
              speed={replaySpeed}
              onSpeedChange={setReplaySpeed}
              onExit={handleToggleReplay}
            />
          )}
        </main>

        {/* Right Sidebar */}
        <RightSidebar
          smcState={smcState}
          config={config}
          onConfigChange={setConfig}
          onSelectElement={setSelectedElement}
          selectedElement={selectedElement}
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
          mtfData={mtfData}
          timeframe={timeframe}
        />
      </div>

      {/* Bottom Status Bar */}
      <BottomStatusBar
        connectionStatus={connectionStatus}
        symbol={symbol}
        timeframe={timeframe}
        smcState={smcState}
        lastCandleTime={lastCandle ? lastCandle.time : 0}
        onToggleDebug={() =>
          setActiveSidebarTab((curr) => (curr === 'debug' ? 'structure' : 'debug'))
        }
        isDebugOpen={activeSidebarTab === 'debug'}
      />

      {/* SMC Event Deep-Dive Inspector Modal */}
      <EventInspectorModal
        element={selectedElement}
        onClose={() => setSelectedElement(null)}
      />

      {/* Unit Test Suite Modal */}
      <TestSuiteModal
        isOpen={isTestSuiteOpen}
        onClose={() => setIsTestSuiteOpen(false)}
      />
    </div>
  );
}
