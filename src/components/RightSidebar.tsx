import React, { useState } from 'react';
import {
  SMCState,
  SMCConfig,
  SelectedSMCElement,
  MTFBias,
  Timeframe,
} from '../types/smc';
import {
  Layers,
  Compass,
  ListFilter,
  Sliders,
  Terminal,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  Target,
  BarChart2,
  Check,
  Flame,
  Info,
  Clock,
} from 'lucide-react';

interface RightSidebarProps {
  smcState: SMCState;
  config: SMCConfig;
  onConfigChange: (newConfig: SMCConfig) => void;
  onSelectElement: (elem: SelectedSMCElement) => void;
  selectedElement: SelectedSMCElement;
  activeTab: 'structure' | 'events' | 'mtf' | 'settings' | 'debug';
  onTabChange: (tab: 'structure' | 'events' | 'mtf' | 'settings' | 'debug') => void;
  mtfData: MTFBias[];
  timeframe: Timeframe;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  smcState,
  config,
  onConfigChange,
  onSelectElement,
  selectedElement,
  activeTab,
  onTabChange,
  mtfData,
  timeframe,
}) => {
  const [filterEventType, setFilterEventType] = useState<'ALL' | 'OB' | 'FVG' | 'BREAK' | 'SWEEP'>('ALL');

  const latestConfluence = smcState.confluenceSignals[smcState.confluenceSignals.length - 1];
  const confluenceScore = latestConfluence ? latestConfluence.score : 50;

  // Filter SMC Events
  const eventsList: {
    id: string;
    type: 'OB' | 'FVG' | 'BREAK' | 'SWEEP';
    title: string;
    subtitle: string;
    direction: 'BULLISH' | 'BEARISH';
    time: number;
    raw: any;
  }[] = [];

  smcState.orderBlocks.forEach((ob) => {
    eventsList.push({
      id: ob.id,
      type: 'OB',
      title: `${ob.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} Order Block`,
      subtitle: `Range: $${ob.low.toFixed(2)} - $${ob.high.toFixed(2)} [${ob.status}]`,
      direction: ob.direction,
      time: ob.openTime,
      raw: { type: 'ORDER_BLOCK', data: ob },
    });
  });

  smcState.fvgs.forEach((fvg) => {
    eventsList.push({
      id: fvg.id,
      type: 'FVG',
      title: `${fvg.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} FVG`,
      subtitle: `Gap: $${fvg.bottom.toFixed(2)} - $${fvg.top.toFixed(2)} (${fvg.fillPercentage}% filled)`,
      direction: fvg.direction,
      time: fvg.candle2Time,
      raw: { type: 'FVG', data: fvg },
    });
  });

  smcState.structureBreaks.forEach((brk) => {
    eventsList.push({
      id: brk.id,
      type: 'BREAK',
      title: `${brk.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} ${brk.type}`,
      subtitle: `Level: $${brk.levelPrice.toFixed(2)} (${brk.confirmationType})`,
      direction: brk.direction,
      time: brk.breakTime,
      raw: { type: 'BREAK', data: brk },
    });
  });

  smcState.liquiditySweeps.forEach((sw) => {
    eventsList.push({
      id: sw.id,
      type: 'SWEEP',
      title: `${sw.type === 'BSL_SWEEP' ? 'Buy-Side' : 'Sell-Side'} Liquidity Sweep`,
      subtitle: `Swept $${sw.targetLevelPrice.toFixed(2)} -> Reached $${sw.sweepPrice.toFixed(2)}`,
      direction: sw.type === 'SSL_SWEEP' ? 'BULLISH' : 'BEARISH',
      time: sw.sweepTime,
      raw: { type: 'SWEEP', data: sw },
    });
  });

  eventsList.sort((a, b) => b.time - a.time);

  const filteredEvents = eventsList.filter((e) => {
    if (filterEventType === 'ALL') return true;
    return e.type === filterEventType;
  });

  return (
    <aside
      id="app-right-sidebar"
      className="w-80 h-full bg-[#161a1e] border-l border-[#2b2f36] flex flex-col select-none text-[#b7bdc6] z-20 font-sans"
    >
      {/* Sidebar Navigation Tabs */}
      <div
        id="sidebar-tabs-header"
        className="flex items-center border-b border-[#2b2f36] bg-[#161a1e] p-1 text-xs font-semibold"
      >
        <button
          id="tab-structure"
          onClick={() => onTabChange('structure')}
          className={`flex-1 py-1.5 rounded flex items-center justify-center space-x-1 transition-colors ${
            activeTab === 'structure'
              ? 'bg-[#2b2f36] text-[#f0b90b] font-bold'
              : 'text-[#848e9c] hover:text-white hover:bg-[#2b2f36]/60'
          }`}
          title="Market Structure Overview"
        >
          <Compass className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Overview</span>
        </button>

        <button
          id="tab-events"
          onClick={() => onTabChange('events')}
          className={`flex-1 py-1.5 rounded flex items-center justify-center space-x-1 transition-colors ${
            activeTab === 'events'
              ? 'bg-[#2b2f36] text-[#f0b90b] font-bold'
              : 'text-[#848e9c] hover:text-white hover:bg-[#2b2f36]/60'
          }`}
          title="SMC Events Log"
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Events</span>
        </button>

        <button
          id="tab-mtf"
          onClick={() => onTabChange('mtf')}
          className={`flex-1 py-1.5 rounded flex items-center justify-center space-x-1 transition-colors ${
            activeTab === 'mtf'
              ? 'bg-[#2b2f36] text-[#f0b90b] font-bold'
              : 'text-[#848e9c] hover:text-white hover:bg-[#2b2f36]/60'
          }`}
          title="Multi-Timeframe Matrix"
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">MTF</span>
        </button>

        <button
          id="tab-settings"
          onClick={() => onTabChange('settings')}
          className={`flex-1 py-1.5 rounded flex items-center justify-center space-x-1 transition-colors ${
            activeTab === 'settings'
              ? 'bg-[#2b2f36] text-[#f0b90b] font-bold'
              : 'text-[#848e9c] hover:text-white hover:bg-[#2b2f36]/60'
          }`}
          title="Indicator Settings"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Config</span>
        </button>

        <button
          id="tab-debug"
          onClick={() => onTabChange('debug')}
          className={`flex-1 py-1.5 rounded flex items-center justify-center space-x-1 transition-colors ${
            activeTab === 'debug'
              ? 'bg-[#2b2f36] text-[#f0b90b] font-bold'
              : 'text-[#848e9c] hover:text-white hover:bg-[#2b2f36]/60'
          }`}
          title="Engine Telemetry & Debug"
        >
          <Terminal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab 1: Market Structure Overview */}
      {activeTab === 'structure' && (
        <div id="panel-market-structure" className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          {/* Structural Bias Card */}
          <div className="bg-[#1e2329] rounded p-3 border border-[#2b2f36]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#848e9c] uppercase tracking-wider">
                Current Structural Bias
              </span>
              <span className="text-[10px] text-[#848e9c] font-mono">{timeframe}</span>
            </div>

            <div className="flex items-center space-x-2.5">
              <div
                className={`p-2 rounded ${
                  smcState.activeBias === 'BULLISH'
                    ? 'bg-[#2ebd85]/15 text-[#2ebd85] border border-[#2ebd85]/30'
                    : smcState.activeBias === 'BEARISH'
                    ? 'bg-[#f6465d]/15 text-[#f6465d] border border-[#f6465d]/30'
                    : 'bg-[#2b2f36] text-[#848e9c]'
                }`}
              >
                {smcState.activeBias === 'BULLISH' ? (
                  <TrendingUp className="w-5 h-5" />
                ) : smcState.activeBias === 'BEARISH' ? (
                  <TrendingDown className="w-5 h-5" />
                ) : (
                  <Compass className="w-5 h-5" />
                )}
              </div>

              <div>
                <div className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span>
                    {smcState.activeBias === 'BULLISH'
                      ? 'Bullish Structure'
                      : smcState.activeBias === 'BEARISH'
                      ? 'Bearish Structure'
                      : 'Neutral / Range'}
                  </span>
                </div>
                <span className="text-[10px] text-[#848e9c] block mt-0.5">
                  {smcState.lastCHoCH
                    ? `Last shift: ${smcState.lastCHoCH.type} @ $${smcState.lastCHoCH.levelPrice.toFixed(2)}`
                    : smcState.lastBOS
                    ? `Continuation: ${smcState.lastBOS.type} @ $${smcState.lastBOS.levelPrice.toFixed(2)}`
                    : 'Awaiting structural break'}
                </span>
              </div>
            </div>
          </div>

          {/* Confluence Meter (0-100) */}
          <div className="bg-[#1e2329] rounded p-3 border border-[#2b2f36]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <Flame className="w-3.5 h-3.5 text-[#f0b90b]" />
                <span className="text-[10px] font-bold text-[#848e9c] uppercase tracking-wider">
                  SMC Confluence Score
                </span>
              </div>
              <span className="font-mono font-bold text-[#f0b90b] text-sm">{confluenceScore}/100</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[#0b0e11] h-2 rounded overflow-hidden p-0.5 mb-2 border border-[#2b2f36]">
              <div
                className={`h-full rounded transition-all duration-300 ${
                  confluenceScore >= 75
                    ? 'bg-[#2ebd85]'
                    : confluenceScore >= 50
                    ? 'bg-[#f0b90b]'
                    : 'bg-[#5e6673]'
                }`}
                style={{ width: `${confluenceScore}%` }}
              />
            </div>

            <div className="text-[11px] text-[#848e9c]">
              {latestConfluence ? (
                <div className="space-y-1">
                  <span className="font-semibold text-white text-[11px]">
                    Trigger: {latestConfluence.primaryTrigger}
                  </span>
                  <div className="space-y-0.5 pt-1">
                    {latestConfluence.factors.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px] text-[#848e9c]">
                        <span>• {f.name}</span>
                        <span className="text-[#2ebd85] font-mono">+{f.points}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-[#5e6673]">No active extreme confluence triggers.</span>
              )}
            </div>
          </div>

          {/* Protected Structure Points */}
          <div className="bg-[#1e2329] rounded p-3 border border-[#2b2f36] space-y-2">
            <span className="text-[10px] font-bold text-[#848e9c] uppercase tracking-wider flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5 text-[#f0b90b]" />
              <span>Protected Structure Levels</span>
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-[#161a1e] border border-[#2b2f36]">
                <span className="text-[9px] text-[#5e6673] block uppercase">Protected High</span>
                <span className="font-mono font-bold text-[#f6465d] text-[11px]">
                  {smcState.protectedHigh
                    ? `$${smcState.protectedHigh.price.toFixed(2)}`
                    : 'None Active'}
                </span>
              </div>

              <div className="p-2 rounded bg-[#161a1e] border border-[#2b2f36]">
                <span className="text-[9px] text-[#5e6673] block uppercase">Protected Low</span>
                <span className="font-mono font-bold text-[#2ebd85] text-[11px]">
                  {smcState.protectedLow
                    ? `$${smcState.protectedLow.price.toFixed(2)}`
                    : 'None Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Dealing Range & Equilibrium */}
          {smcState.dealingRange && (
            <div className="bg-[#1e2329] rounded p-3 border border-[#2b2f36] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#848e9c] uppercase tracking-wider">
                  Dealing Range
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    smcState.dealingRange.currentZone === 'PREMIUM'
                      ? 'bg-[#f6465d]/20 text-[#f6465d]'
                      : smcState.dealingRange.currentZone === 'DISCOUNT'
                      ? 'bg-[#2ebd85]/20 text-[#2ebd85]'
                      : 'bg-[#2b2f36] text-[#b7bdc6]'
                  }`}
                >
                  {smcState.dealingRange.currentZone}
                </span>
              </div>

              <div className="space-y-1 font-mono text-[10px] text-[#b7bdc6]">
                <div className="flex justify-between">
                  <span className="text-[#5e6673]">Range High:</span>
                  <span className="text-white">${smcState.dealingRange.high.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5e6673]">Equilibrium (50%):</span>
                  <span className="text-[#f0b90b] font-bold">
                    ${smcState.dealingRange.equilibrium.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5e6673]">Range Low:</span>
                  <span className="text-white">${smcState.dealingRange.low.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Active Inventory Count */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-[#1e2329] p-2 rounded border border-[#2b2f36]">
              <span className="text-[#5e6673] text-[9px] uppercase block">Active OBs</span>
              <span className="text-sm font-bold text-white font-mono">
                {smcState.orderBlocks.filter((o) => o.status === 'FRESH' || o.status === 'TESTED').length}
              </span>
            </div>
            <div className="bg-[#1e2329] p-2 rounded border border-[#2b2f36]">
              <span className="text-[#5e6673] text-[9px] uppercase block">Active FVGs</span>
              <span className="text-sm font-bold text-[#2ebd85] font-mono">
                {smcState.fvgs.filter((f) => f.status === 'FRESH' || f.status === 'PARTIALLY_FILLED').length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: SMC Events Log */}
      {activeTab === 'events' && (
        <div id="panel-smc-events" className="flex-1 flex flex-col overflow-hidden">
          {/* Filter Pills */}
          <div className="p-1.5 border-b border-[#2b2f36] flex items-center space-x-1 bg-[#161a1e] text-[10px]">
            {(['ALL', 'OB', 'FVG', 'BREAK', 'SWEEP'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterEventType(type)}
                className={`px-2 py-0.5 rounded transition-colors font-medium ${
                  filterEventType === type
                    ? 'bg-[#2b2f36] text-[#f0b90b] font-bold'
                    : 'text-[#848e9c] hover:text-white hover:bg-[#2b2f36]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Events List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-[#5e6673] text-xs">
                No SMC events found in current window.
              </div>
            ) : (
              filteredEvents.map((evt) => {
                const isSelected = selectedElement && (selectedElement as any).data?.id === evt.raw.data.id;
                const isBull = evt.direction === 'BULLISH';

                return (
                  <div
                    key={evt.id}
                    onClick={() => onSelectElement(evt.raw)}
                    className={`p-2 rounded border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#2b2f36] border-[#f0b90b] text-white'
                        : 'bg-[#1e2329] border-[#2b2f36] hover:border-[#474d57] text-[#b7bdc6]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center space-x-1.5 font-bold">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isBull ? 'bg-[#2ebd85]' : 'bg-[#f6465d]'
                          }`}
                        />
                        <span className="text-[11px] text-white">{evt.title}</span>
                      </div>
                      <span className="text-[9px] text-[#848e9c] font-mono">
                        {new Date(evt.time * 1000).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#848e9c] font-mono flex items-center justify-between">
                      <span className="truncate pr-1">{evt.subtitle}</span>
                      <ChevronRight className="w-3 h-3 text-[#5e6673] shrink-0" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Multi-Timeframe Matrix */}
      {activeTab === 'mtf' && (
        <div id="panel-mtf-matrix" className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-[#848e9c] uppercase tracking-wider">
              Multi-Timeframe Structure Matrix
            </span>
            <p className="text-[10px] text-[#5e6673]">
              Correlating lower-timeframe execution with higher-timeframe order flow.
            </p>
          </div>

          <div className="border border-[#2b2f36] rounded overflow-hidden bg-[#1e2329]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#2b2f36] bg-[#161a1e] text-[9px] text-[#848e9c] font-mono uppercase">
                  <th className="p-2">TF</th>
                  <th className="p-2">Structure</th>
                  <th className="p-2">Bias</th>
                  <th className="p-2 text-right">Conf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2f36] font-mono">
                {mtfData.map((row) => (
                  <tr
                    key={row.timeframe}
                    className={`hover:bg-[#2b2f36]/40 transition-colors ${
                      row.timeframe === timeframe ? 'bg-[#2b2f36]/60 font-bold' : ''
                    }`}
                  >
                    <td className="p-2 text-white">
                      <span className="px-1 py-0.5 rounded bg-[#161a1e] border border-[#2b2f36] text-[10px]">
                        {row.timeframe}
                      </span>
                    </td>
                    <td className="p-2 text-[#b7bdc6] text-[10px]">
                      {row.structure === 'HH_HL' ? 'HH / HL' : row.structure === 'LH_LL' ? 'LH / LL' : 'Range'}
                    </td>
                    <td className="p-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          row.bias === 'BULLISH'
                            ? 'bg-[#2ebd85]/20 text-[#2ebd85]'
                            : row.bias === 'BEARISH'
                            ? 'bg-[#f6465d]/20 text-[#f6465d]'
                            : 'bg-[#2b2f36] text-[#848e9c]'
                        }`}
                      >
                        {row.bias}
                      </span>
                    </td>
                    <td className="p-2 text-right text-[#848e9c] text-[10px]">
                      {row.confluenceScore}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Indicator Settings & Toggles */}
      {activeTab === 'settings' && (
        <div id="panel-smc-settings" className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-[#848e9c] uppercase tracking-wider">
                SMC Algorithm & Visual Config
              </span>
              <p className="text-[10px] text-[#5e6673]">Configure which SMC events are drawn on the chart.</p>
            </div>
          </div>

          {/* Master Quick Actions */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              id="btn-settings-show-all"
              onClick={() =>
                onConfigChange({
                  ...config,
                  showOrderBlocks: true,
                  showFVG: true,
                  showBOS: true,
                  showCHoCH: true,
                  showMSS: true,
                  showLiquidityPools: true,
                  showLiquiditySweeps: true,
                  showSwingStructure: true,
                  showInternalStructure: true,
                  showDealingRange: true,
                  showOTE: true,
                  showPDH_PDL: true,
                  showPWH_PWL: true,
                  showDisplacement: true,
                  showConfluenceSignals: true,
                  showEventBadges: true,
                })
              }
              className="px-2 py-1.5 rounded bg-[#1e2329] border border-[#2ebd85]/40 text-[#2ebd85] font-bold text-[10px] hover:bg-[#2ebd85]/10 text-center transition-colors"
            >
              ✓ Show All Events
            </button>
            <button
              id="btn-settings-hide-all"
              onClick={() =>
                onConfigChange({
                  ...config,
                  showOrderBlocks: false,
                  showFVG: false,
                  showBOS: false,
                  showCHoCH: false,
                  showMSS: false,
                  showLiquidityPools: false,
                  showLiquiditySweeps: false,
                  showSwingStructure: false,
                  showInternalStructure: false,
                  showDealingRange: false,
                  showOTE: false,
                  showPDH_PDL: false,
                  showPWH_PWL: false,
                  showDisplacement: false,
                  showConfluenceSignals: false,
                })
              }
              className="px-2 py-1.5 rounded bg-[#1e2329] border border-[#f6465d]/40 text-[#f6465d] font-bold text-[10px] hover:bg-[#f6465d]/10 text-center transition-colors"
            >
              ✕ Hide All Events
            </button>
          </div>

          {/* Toggle Switches */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Major Swing Structure (HH / LL)</span>
              <input
                type="checkbox"
                checked={config.showSwingStructure}
                onChange={(e) => onConfigChange({ ...config, showSwingStructure: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Internal Structure (ih / il)</span>
              <input
                type="checkbox"
                checked={config.showInternalStructure}
                onChange={(e) => onConfigChange({ ...config, showInternalStructure: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Break of Structure (BOS)</span>
              <input
                type="checkbox"
                checked={config.showBOS}
                onChange={(e) => onConfigChange({ ...config, showBOS: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Change of Character (CHoCH / MSS)</span>
              <input
                type="checkbox"
                checked={config.showCHoCH}
                onChange={(e) => onConfigChange({ ...config, showCHoCH: e.target.checked, showMSS: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Order Blocks (Supply & Demand OBs)</span>
              <input
                type="checkbox"
                checked={config.showOrderBlocks}
                onChange={(e) => onConfigChange({ ...config, showOrderBlocks: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Fair Value Gaps (FVG)</span>
              <input
                type="checkbox"
                checked={config.showFVG}
                onChange={(e) => onConfigChange({ ...config, showFVG: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Equal Highs / Lows ($$$ Liquidity)</span>
              <input
                type="checkbox"
                checked={config.showLiquidityPools}
                onChange={(e) => onConfigChange({ ...config, showLiquidityPools: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Liquidity Sweeps (Wick Purges)</span>
              <input
                type="checkbox"
                checked={config.showLiquiditySweeps}
                onChange={(e) => onConfigChange({ ...config, showLiquiditySweeps: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Dealing Range & Equilibrium (50%)</span>
              <input
                type="checkbox"
                checked={config.showDealingRange}
                onChange={(e) => onConfigChange({ ...config, showDealingRange: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Optimal Trade Entry (OTE 61.8% - 78.6%)</span>
              <input
                type="checkbox"
                checked={config.showOTE}
                onChange={(e) => onConfigChange({ ...config, showOTE: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Previous Day Key Levels (PDH / PDL)</span>
              <input
                type="checkbox"
                checked={config.showPDH_PDL}
                onChange={(e) => onConfigChange({ ...config, showPDH_PDL: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>SMC Confluence Buy/Sell Strategy Signals</span>
              <input
                type="checkbox"
                checked={config.showConfluenceSignals}
                onChange={(e) => onConfigChange({ ...config, showConfluenceSignals: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Displacement Momentum Highlights</span>
              <input
                type="checkbox"
                checked={config.showDisplacement}
                onChange={(e) => onConfigChange({ ...config, showDisplacement: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-white">
              <span>Show On-Chart Text Badges & Labels</span>
              <input
                type="checkbox"
                checked={config.showEventBadges !== false}
                onChange={(e) => onConfigChange({ ...config, showEventBadges: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>
          </div>

          {/* Historical & Invalidation Controls */}
          <div className="space-y-1.5 pt-2 border-t border-[#2b2f36]">
            <span className="text-[10px] font-bold text-[#848e9c] uppercase tracking-wider block">
              Zone Lifecycle Filters
            </span>
            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-[#848e9c]">
              <span>Show Mitigated / Filled FVGs</span>
              <input
                type="checkbox"
                checked={config.showFilledFVGs}
                onChange={(e) => onConfigChange({ ...config, showFilledFVGs: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between p-2 rounded bg-[#1e2329] border border-[#2b2f36] hover:border-[#474d57] cursor-pointer text-[11px] text-[#848e9c]">
              <span>Show Invalidated Order Blocks</span>
              <input
                type="checkbox"
                checked={config.showInvalidatedOBs}
                onChange={(e) => onConfigChange({ ...config, showInvalidatedOBs: e.target.checked })}
                className="rounded accent-[#f0b90b] cursor-pointer"
              />
            </label>
          </div>

          {/* Sliders & Numeric Config */}
          <div className="space-y-2.5 pt-2 border-t border-[#2b2f36]">
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-[#848e9c]">Swing Pivot Lookback:</span>
                <span className="font-mono font-bold text-[#f0b90b]">{config.swingPivotLookback} bars</span>
              </div>
              <input
                type="range"
                min="2"
                max="15"
                value={config.swingPivotLookback}
                onChange={(e) => onConfigChange({ ...config, swingPivotLookback: Number(e.target.value) })}
                className="w-full accent-[#f0b90b] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-[#848e9c]">Min FVG ATR Ratio:</span>
                <span className="font-mono font-bold text-[#2ebd85]">{config.fvgMinAtrRatio}x ATR</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={config.fvgMinAtrRatio}
                onChange={(e) => onConfigChange({ ...config, fvgMinAtrRatio: Number(e.target.value) })}
                className="w-full accent-[#2ebd85] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-[#848e9c]">Min Confluence Score:</span>
                <span className="font-mono font-bold text-[#f0b90b]">{config.minConfluenceScore || 55}/100</span>
              </div>
              <input
                type="range"
                min="30"
                max="90"
                step="5"
                value={config.minConfluenceScore || 55}
                onChange={(e) => onConfigChange({ ...config, minConfluenceScore: Number(e.target.value) })}
                className="w-full accent-[#f0b90b] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-[#848e9c]">BOS Confirmation:</span>
                <span className="font-mono font-bold text-white">{config.bosConfirmation}</span>
              </div>
              <select
                value={config.bosConfirmation}
                onChange={(e) => onConfigChange({ ...config, bosConfirmation: e.target.value as any })}
                className="w-full bg-[#1e2329] border border-[#2b2f36] rounded p-1 text-xs text-white"
              >
                <option value="CLOSE">Candle Close (Recommended)</option>
                <option value="WICK">Wick Break</option>
                <option value="DISPLACEMENT">Close + Strong Displacement</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Debug & Telemetry */}
      {activeTab === 'debug' && (
        <div id="panel-engine-debug" className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-[10px]">
          <div className="flex items-center space-x-1.5 text-[#f0b90b] font-bold uppercase tracking-wider text-xs">
            <Terminal className="w-3.5 h-3.5" />
            <span>Engine Telemetry</span>
          </div>

          <div className="bg-[#0b0e11] p-2.5 rounded border border-[#2b2f36] text-[#848e9c] space-y-1">
            <div>• Zero Look-Ahead Bias: <span className="text-[#2ebd85] font-bold">VERIFIED</span></div>
            <div>• Pivot Confirmation Delay: <span className="text-[#f0b90b] font-bold">+{config.swingPivotLookback} bars</span></div>
            <div>• Historical Recalculations: <span className="text-[#848e9c] font-bold">Memoized</span></div>
            <div>• Active Candle Updates: <span className="text-[#2ebd85] font-bold">Non-Destructive</span></div>
          </div>

          <div className="space-y-1">
            <span className="text-[#5e6673] text-[9px] uppercase block">Engine Execution Logs:</span>
            <div className="bg-[#0b0e11] p-2 rounded border border-[#2b2f36] h-60 overflow-y-auto space-y-0.5 text-[#848e9c] text-[9px]">
              {smcState.debugLogs.map((log, i) => (
                <div key={i} className="text-[#b7bdc6]">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
