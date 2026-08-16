import React from 'react';
import { SelectedSMCElement } from '../types/smc';
import {
  ShieldAlert,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  Target,
  FileText,
  X,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';

interface EventInspectorModalProps {
  element: SelectedSMCElement;
  onClose: () => void;
}

export const EventInspectorModal: React.FC<EventInspectorModalProps> = ({
  element,
  onClose,
}) => {
  if (!element) return null;

  let title = '';
  let typeLabel = '';
  let direction: 'BULLISH' | 'BEARISH' = 'BULLISH';
  let createdTime = 0;
  let priceRange = '';
  let status = '';
  let confluence = 50;
  let rationale = '';
  let details: { label: string; value: string }[] = [];

  if (element.type === 'ORDER_BLOCK') {
    const ob = element.data;
    title = `${ob.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} Order Block`;
    typeLabel = 'Institutional Order Block';
    direction = ob.direction;
    createdTime = ob.openTime;
    priceRange = `$${ob.low.toFixed(2)} - $${ob.high.toFixed(2)}`;
    status = ob.status;
    confluence = ob.confluenceScore;
    rationale = ob.rationale;
    details = [
      { label: 'Trigger Structure', value: ob.triggerStructureType || 'BOS Break' },
      { label: 'Displacement Strength', value: ob.displacement },
      { label: 'Fair Value Gap Present', value: ob.hasFVG ? 'Yes (Confluence +15)' : 'No' },
      { label: 'Preceding Liquidity Sweep', value: ob.hasSweep ? 'Yes (Confluence +15)' : 'No' },
      { label: 'Test / Retest Count', value: `${ob.testCount} touches` },
      { label: 'Mitigation Status', value: ob.status },
    ];
  } else if (element.type === 'FVG') {
    const fvg = element.data;
    title = `${fvg.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} Fair Value Gap (FVG)`;
    typeLabel = '3-Candle Price Imbalance';
    direction = fvg.direction;
    createdTime = fvg.candle2Time;
    priceRange = `$${fvg.bottom.toFixed(2)} - $${fvg.top.toFixed(2)}`;
    status = fvg.status;
    confluence = fvg.confluenceScore;
    rationale = fvg.rationale;
    details = [
      { label: 'Equilibrium Midpoint (50%)', value: `$${fvg.mid.toFixed(2)}` },
      { label: 'Relative Gap Size', value: `${fvg.sizeATR}x ATR (${fvg.sizePercent}%)` },
      { label: 'Fill / Retracement', value: `${fvg.fillPercentage}% filled` },
      { label: 'Status', value: fvg.status },
    ];
  } else if (element.type === 'BREAK') {
    const brk = element.data;
    title = `${brk.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} ${brk.type}`;
    typeLabel =
      brk.type === 'MSS'
        ? 'Market Structure Shift'
        : brk.type === 'CHoCH'
        ? 'Change of Character'
        : 'Break of Structure';
    direction = brk.direction;
    createdTime = brk.breakTime;
    priceRange = `$${brk.levelPrice.toFixed(2)}`;
    status = 'CONFIRMED';
    confluence = brk.type === 'MSS' ? 85 : brk.type === 'CHoCH' ? 75 : 60;
    rationale = brk.rationale;
    details = [
      { label: 'Structure Type', value: brk.type },
      { label: 'Breakout Level Price', value: `$${brk.levelPrice.toFixed(2)}` },
      { label: 'Confirmation Mechanism', value: `${brk.confirmationType} Confirmation` },
      { label: 'Displacement Multiplier', value: `${brk.displacementScore}x ATR` },
    ];
  } else if (element.type === 'SWEEP') {
    const sw = element.data;
    title = `${sw.type === 'BSL_SWEEP' ? 'Buy-Side' : 'Sell-Side'} Liquidity Sweep`;
    typeLabel = 'Liquidity Purge Event';
    direction = sw.type === 'SSL_SWEEP' ? 'BULLISH' : 'BEARISH';
    createdTime = sw.sweepTime;
    priceRange = `Target: $${sw.targetLevelPrice.toFixed(2)} | Reached: $${sw.sweepPrice.toFixed(2)}`;
    status = 'CONFIRMED';
    confluence = 80;
    rationale = sw.rationale;
    details = [
      { label: 'Swept Pool Type', value: sw.type },
      { label: 'Level Swept', value: `$${sw.targetLevelPrice.toFixed(2)}` },
      { label: 'Extreme Wick Price', value: `$${sw.sweepPrice.toFixed(2)}` },
      { label: 'Displacement Rejection', value: `${sw.displacementScore}x ATR` },
    ];
  } else if (element.type === 'LIQUIDITY_POOL') {
    const pool = element.data;
    title = `${pool.type} Liquidity Pool`;
    typeLabel = 'Resting Orderbook Liquidity';
    direction = pool.type === 'EQH' || pool.type === 'BSL' ? 'BEARISH' : 'BULLISH';
    createdTime = pool.timeRange[0];
    priceRange = `$${pool.price.toFixed(2)}`;
    status = pool.status;
    confluence = 70;
    rationale = pool.rationale;
    details = [
      { label: 'Pool Type', value: pool.type },
      { label: 'Level Price', value: `$${pool.price.toFixed(2)}` },
      { label: 'Equal Tolerance', value: `${pool.tolerance}%` },
      { label: 'Status', value: pool.status },
    ];
  }

  return (
    <div
      id="smc-event-inspector-modal"
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none font-sans"
    >
      <div className="bg-[#161a1e] border border-[#2b2f36] rounded-lg w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#2b2f36] flex items-center justify-between bg-[#161a1e]">
          <div className="flex items-center space-x-2.5">
            <div
              className={`p-1.5 rounded ${
                direction === 'BULLISH'
                  ? 'bg-[#2ebd85]/15 text-[#2ebd85] border border-[#2ebd85]/30'
                  : 'bg-[#f6465d]/15 text-[#f6465d] border border-[#f6465d]/30'
              }`}
            >
              {direction === 'BULLISH' ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    status === 'FRESH'
                      ? 'bg-[#2ebd85]/20 text-[#2ebd85]'
                      : status === 'MITIGATED'
                      ? 'bg-[#f0b90b]/20 text-[#f0b90b]'
                      : 'bg-[#2b2f36] text-[#848e9c]'
                  }`}
                >
                  {status}
                </span>
              </div>
              <span className="text-[10px] text-[#848e9c]">{typeLabel}</span>
            </div>
          </div>

          <button
            id="btn-close-inspector"
            onClick={onClose}
            className="p-1 rounded bg-[#1e2329] border border-[#2b2f36] text-[#848e9c] hover:text-white hover:bg-[#2b2f36] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 text-xs">
          {/* Price and Confluence Snapshot */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded bg-[#1e2329] border border-[#2b2f36]">
              <span className="text-[9px] text-[#5e6673] block uppercase">Price / Range</span>
              <span className="text-xs font-bold font-mono text-white">{priceRange}</span>
            </div>
            <div className="p-2.5 rounded bg-[#1e2329] border border-[#2b2f36]">
              <span className="text-[9px] text-[#5e6673] block uppercase">Confluence Score</span>
              <span className="text-xs font-bold font-mono text-[#f0b90b]">{confluence}/100</span>
            </div>
          </div>

          {/* Algorithmic Rationale Box */}
          <div className="p-3 rounded bg-[#1e2329] border border-[#2b2f36] space-y-1">
            <div className="flex items-center space-x-1 text-[#f0b90b] font-semibold uppercase text-[9px] tracking-wider">
              <Info className="w-3 h-3" />
              <span>Algorithmic Classification Rationale</span>
            </div>
            <p className="text-[#b7bdc6] leading-relaxed text-[11px]">{rationale}</p>
          </div>

          {/* Attributes Matrix */}
          <div className="border border-[#2b2f36] rounded overflow-hidden bg-[#1e2329]">
            <div className="divide-y divide-[#2b2f36]">
              {details.map((item, idx) => (
                <div key={idx} className="flex justify-between px-3 py-1.5 text-[11px]">
                  <span className="text-[#848e9c]">{item.label}</span>
                  <span className="font-mono text-white font-medium">{item.value}</span>
                </div>
              ))}
              <div className="flex justify-between px-3 py-1.5 text-[11px]">
                <span className="text-[#848e9c]">Creation Timestamp</span>
                <span className="font-mono text-[#848e9c]">
                  {createdTime ? new Date(createdTime * 1000).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#2b2f36] bg-[#161a1e] flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#f0b90b] hover:bg-[#fcd535] text-[#0b0e11] font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
