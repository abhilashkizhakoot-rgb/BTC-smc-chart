import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  CrosshairMode,
  UTCTimestamp,
  CandlestickSeries,
  HistogramSeries,
} from 'lightweight-charts';
import {
  Candle,
  SMCState,
  SMCConfig,
  SelectedSMCElement,
  Timeframe,
} from '../types/smc';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
} from 'lucide-react';

interface TradingChartProps {
  candles: Candle[];
  smcState: SMCState;
  config: SMCConfig;
  symbol: string;
  timeframe: Timeframe;
  onSelectElement: (elem: SelectedSMCElement) => void;
  selectedElement: SelectedSMCElement;
  onConfigChange?: (config: SMCConfig) => void;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  smcState,
  config,
  symbol,
  timeframe,
  onSelectElement,
  selectedElement,
  onConfigChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredOHLC, setHoveredOHLC] = useState<Candle | null>(null);
  const [candleCountdown, setCandleCountdown] = useState<string>('');
  const [isToolbarExpanded, setIsToolbarExpanded] = useState<boolean>(true);

  // Check if all primary SMC layers are currently visible
  const areAllLayersActive =
    config.showOrderBlocks &&
    config.showFVG &&
    config.showBOS &&
    config.showCHoCH &&
    config.showLiquidityPools &&
    config.showLiquiditySweeps &&
    config.showSwingStructure &&
    config.showDealingRange;

  const toggleAllLayers = () => {
    if (!onConfigChange) return;
    const targetState = !areAllLayersActive;
    onConfigChange({
      ...config,
      showOrderBlocks: targetState,
      showFVG: targetState,
      showBOS: targetState,
      showCHoCH: targetState,
      showMSS: targetState,
      showLiquidityPools: targetState,
      showLiquiditySweeps: targetState,
      showSwingStructure: targetState,
      showInternalStructure: targetState,
      showDealingRange: targetState,
      showOTE: targetState,
      showPDH_PDL: targetState,
      showPWH_PWL: targetState,
      showDisplacement: targetState,
      showConfluenceSignals: targetState,
    });
  };

  const toggleIndividualConfig = (key: keyof SMCConfig) => {
    if (!onConfigChange) return;
    onConfigChange({
      ...config,
      [key]: !config[key],
    });
  };

  // Countdown timer for active candle
  useEffect(() => {
    const updateCountdown = () => {
      if (candles.length === 0) return;
      const lastCandle = candles[candles.length - 1];
      const intervalSec =
        timeframe === '1m' ? 60 :
        timeframe === '3m' ? 180 :
        timeframe === '5m' ? 300 :
        timeframe === '15m' ? 900 :
        timeframe === '30m' ? 1800 :
        timeframe === '1h' ? 3600 :
        timeframe === '4h' ? 14400 : 86400;

      const now = Math.floor(Date.now() / 1000);
      const closeTime = lastCandle.time + intervalSec;
      const diff = Math.max(0, closeTime - now);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setCandleCountdown(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [candles, timeframe]);

  // Robust Coordinate lookup helper for time values (even if bar scrolled past left edge)
  const getXForTime = useCallback((targetTime: number, width: number, timeScale: any): number => {
    const directX = timeScale.timeToCoordinate(targetTime as UTCTimestamp);
    if (directX !== null) return directX;

    if (candles.length === 0) return 0;
    if (targetTime <= candles[0].time) {
      // It's before or at the first candle
      const firstX = timeScale.timeToCoordinate(candles[0].time as UTCTimestamp);
      if (firstX !== null) {
        return Math.min(firstX, 0);
      }
      return 0;
    }
    if (targetTime >= candles[candles.length - 1].time) {
      const lastX = timeScale.timeToCoordinate(candles[candles.length - 1].time as UTCTimestamp);
      if (lastX !== null) return lastX;
      return width;
    }

    // Binary search closest available candle time
    let low = 0;
    let high = candles.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (candles[mid].time === targetTime) {
        const x = timeScale.timeToCoordinate(candles[mid].time as UTCTimestamp);
        if (x !== null) return x;
        break;
      }
      if (candles[mid].time < targetTime) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // fallback to closest candle index
    const nearestIdx = Math.max(0, Math.min(candles.length - 1, low));
    const nearX = timeScale.timeToCoordinate(candles[nearestIdx].time as UTCTimestamp);
    return nearX !== null ? nearX : 0;
  }, [candles]);

  // Draw All SMC Overlays and Events on High-Resolution Canvas
  const drawOverlays = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!canvas || !chart || !series || candles.length === 0) return;

    // Ensure canvas internal pixel size matches CSS layout client rect
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return;

    ctx.clearRect(0, 0, width, height);

    const timeScale = chart.timeScale();
    const rightmostX = width - 68; // Leave margin for right price scale
    const showBadges = config.showEventBadges !== false;

    // 1. Draw Dealing Range / Premium & Discount & OTE Fibonacci Zone
    if (config.showDealingRange && smcState.dealingRange) {
      const dr = smcState.dealingRange;
      const topY = series.priceToCoordinate(dr.high);
      const eqY = series.priceToCoordinate(dr.equilibrium);
      const botY = series.priceToCoordinate(dr.low);

      if (topY !== null && eqY !== null && botY !== null) {
        // Premium Zone Shading (Upper half - Bearish discount opportunity)
        ctx.fillStyle = 'rgba(246, 70, 93, 0.04)';
        ctx.fillRect(0, Math.min(topY, eqY), rightmostX, Math.abs(topY - eqY));

        // Discount Zone Shading (Lower half - Bullish accumulation opportunity)
        ctx.fillStyle = 'rgba(46, 189, 133, 0.04)';
        ctx.fillRect(0, Math.min(eqY, botY), rightmostX, Math.abs(eqY - botY));

        // Equilibrium line (50% Fair Value Mean)
        ctx.strokeStyle = 'rgba(132, 142, 156, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, eqY);
        ctx.lineTo(rightmostX, eqY);
        ctx.stroke();
        ctx.setLineDash([]);

        if (showBadges) {
          ctx.fillStyle = '#848e9c';
          ctx.font = '10px monospace';
          ctx.fillText(`EQ (50.0%): $${dr.equilibrium.toFixed(2)}`, 14, eqY - 5);
        }

        // Optimal Trade Entry Zone (0.618 - 0.786 Retracement)
        if (config.showOTE && dr.oteZone) {
          const oteTopY = series.priceToCoordinate(dr.oteZone[1]);
          const oteBotY = series.priceToCoordinate(dr.oteZone[0]);
          if (oteTopY !== null && oteBotY !== null) {
            const minY = Math.min(oteTopY, oteBotY);
            const spanH = Math.abs(oteTopY - oteBotY);
            ctx.fillStyle = 'rgba(240, 185, 11, 0.08)';
            ctx.fillRect(0, minY, rightmostX, spanH);

            ctx.strokeStyle = 'rgba(240, 185, 11, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(0, minY, rightmostX, spanH);
            ctx.setLineDash([]);

            if (showBadges) {
              ctx.fillStyle = '#f0b90b';
              ctx.font = 'bold 9px monospace';
              ctx.fillText(`OTE (61.8% - 78.6%)`, 14, minY + 12);
            }
          }
        }
      }
    }

    // 2. Draw Previous Key Benchmark Levels (PDH / PDL)
    if (config.showPDH_PDL && smcState.prevHighLow) {
      const { pdh, pdl, pdhSwept, pdlSwept } = smcState.prevHighLow;
      if (pdh !== undefined) {
        const y = series.priceToCoordinate(pdh);
        if (y !== null) {
          ctx.strokeStyle = pdhSwept ? 'rgba(246, 70, 93, 0.35)' : '#f6465d';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(rightmostX, y);
          ctx.stroke();
          ctx.setLineDash([]);

          if (showBadges) {
            ctx.fillStyle = pdhSwept ? '#848e9c' : '#f6465d';
            ctx.font = '9px monospace';
            ctx.fillText(`PDH $${pdh.toFixed(2)} ${pdhSwept ? '[SWEPT]' : '[ACTIVE]'}`, 14, y - 4);
          }
        }
      }

      if (pdl !== undefined) {
        const y = series.priceToCoordinate(pdl);
        if (y !== null) {
          ctx.strokeStyle = pdlSwept ? 'rgba(46, 189, 133, 0.35)' : '#2ebd85';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(rightmostX, y);
          ctx.stroke();
          ctx.setLineDash([]);

          if (showBadges) {
            ctx.fillStyle = pdlSwept ? '#848e9c' : '#2ebd85';
            ctx.font = '9px monospace';
            ctx.fillText(`PDL $${pdl.toFixed(2)} ${pdlSwept ? '[SWEPT]' : '[ACTIVE]'}`, 14, y + 11);
          }
        }
      }
    }

    // 3. Draw Fair Value Gaps (FVG)
    if (config.showFVG && smcState.fvgs) {
      smcState.fvgs.forEach((fvg) => {
        if (!config.showFilledFVGs && fvg.status === 'MITIGATED') return;

        const startX = getXForTime(fvg.candle1Time, width, timeScale);
        const topY = series.priceToCoordinate(fvg.top);
        const botY = series.priceToCoordinate(fvg.bottom);
        const midY = series.priceToCoordinate(fvg.mid);

        if (topY === null || botY === null) return;
        const x1 = Math.max(0, startX);
        let x2 = rightmostX;
        if (fvg.mitigationTime) {
          x2 = Math.min(rightmostX, getXForTime(fvg.mitigationTime, width, timeScale));
        }

        if (x2 <= x1) return;

        const isBullish = fvg.direction === 'BULLISH';
        const isSelected = selectedElement?.type === 'FVG' && selectedElement.data.id === fvg.id;

        // Background box
        ctx.fillStyle = isBullish
          ? isSelected
            ? 'rgba(46, 189, 133, 0.45)'
            : 'rgba(46, 189, 133, 0.2)'
          : isSelected
          ? 'rgba(246, 70, 93, 0.45)'
          : 'rgba(246, 70, 93, 0.2)';

        const rectY = Math.min(topY, botY);
        const rectH = Math.max(3, Math.abs(topY - botY));
        ctx.fillRect(x1, rectY, x2 - x1, rectH);

        // Border stroke
        ctx.strokeStyle = isBullish ? '#2ebd85' : '#f6465d';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(x1, rectY, x2 - x1, rectH);

        // 50% Consequent Encroachment (C.E.) Midline
        if (midY !== null) {
          ctx.strokeStyle = isBullish ? 'rgba(46, 189, 133, 0.7)' : 'rgba(246, 70, 93, 0.7)';
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(x1, midY);
          ctx.lineTo(x2, midY);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Label Badge
        if (showBadges && x2 - x1 > 25) {
          ctx.fillStyle = isBullish ? '#2ebd85' : '#f6465d';
          ctx.font = 'bold 9px monospace';
          const label = `${isBullish ? '+FVG' : '-FVG'} ${
            fvg.status === 'MITIGATED' ? '[FILLED]' : '[50% C.E.]'
          }`;
          ctx.fillText(label, x1 + 6, rectY + 11);
        }
      });
    }

    // 4. Draw Order Blocks (OB)
    if (config.showOrderBlocks && smcState.orderBlocks) {
      smcState.orderBlocks.forEach((ob) => {
        if (!config.showInvalidatedOBs && ob.status === 'INVALIDATED') return;

        const startX = getXForTime(ob.openTime, width, timeScale);
        const topY = series.priceToCoordinate(ob.high);
        const botY = series.priceToCoordinate(ob.low);
        if (topY === null || botY === null) return;

        const x1 = Math.max(0, startX);
        let x2 = rightmostX;
        if (ob.mitigationTime) {
          x2 = Math.min(rightmostX, getXForTime(ob.mitigationTime, width, timeScale));
        }

        if (x2 <= x1) return;

        const isBullish = ob.direction === 'BULLISH';
        const isSelected = selectedElement?.type === 'ORDER_BLOCK' && selectedElement.data.id === ob.id;

        const rectY = Math.min(topY, botY);
        const rectH = Math.max(4, Math.abs(topY - botY));

        // Shaded Box
        ctx.fillStyle = isBullish
          ? isSelected
            ? 'rgba(46, 189, 133, 0.5)'
            : 'rgba(46, 189, 133, 0.22)'
          : isSelected
          ? 'rgba(246, 70, 93, 0.5)'
          : 'rgba(246, 70, 93, 0.22)';

        ctx.fillRect(x1, rectY, x2 - x1, rectH);

        // Border with accent
        ctx.strokeStyle = isBullish ? '#2ebd85' : '#f6465d';
        ctx.lineWidth = isSelected ? 2.5 : 1.2;
        ctx.strokeRect(x1, rectY, x2 - x1, rectH);

        // 50% Mean Threshold dashed line
        const midY = (topY + botY) / 2;
        ctx.strokeStyle = isBullish ? 'rgba(46, 189, 133, 0.6)' : 'rgba(246, 70, 93, 0.6)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, midY);
        ctx.lineTo(x2, midY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label Badge
        if (showBadges && x2 - x1 > 30) {
          ctx.fillStyle = isBullish ? '#2ebd85' : '#f6465d';
          ctx.font = 'bold 9px monospace';
          const testTag = ob.testCount > 0 ? ` (x${ob.testCount})` : '';
          const label = `${isBullish ? 'BULL' : 'BEAR'} OB [${ob.status}${testTag}]`;
          ctx.fillText(label, x1 + 6, rectY + 11);
        }
      });
    }

    // 5. Draw Structure Breaks (BOS, CHoCH, MSS)
    if (smcState.structureBreaks) {
      smcState.structureBreaks.forEach((brk) => {
        if (brk.type === 'BOS' && !config.showBOS) return;
        if (brk.type === 'CHoCH' && !config.showCHoCH) return;
        if (brk.type === 'MSS' && !config.showMSS) return;

        const originX = getXForTime(brk.originTime, width, timeScale);
        const breakX = getXForTime(brk.breakTime, width, timeScale);
        const y = series.priceToCoordinate(brk.levelPrice);

        if (y === null) return;
        const x1 = Math.max(0, originX);
        const x2 = Math.min(rightmostX, breakX);

        if (x2 <= x1) return;

        const isBull = brk.direction === 'BULLISH';
        const isCHoCH = brk.type === 'CHoCH' || brk.type === 'MSS';
        const color = isCHoCH ? '#f0b90b' : isBull ? '#2ebd85' : '#f6465d';

        ctx.strokeStyle = color;
        ctx.lineWidth = isCHoCH ? 2 : 1.5;
        ctx.setLineDash(isCHoCH ? [4, 2] : [6, 3]);

        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Badge at break confirmation point
        if (showBadges) {
          const badgeText = `${isBull ? '▲' : '▼'} ${brk.type}`;
          ctx.font = 'bold 9px monospace';
          const textWidth = ctx.measureText(badgeText).width;
          const badgeX = x2 - textWidth - 8;
          const badgeY = y + (isBull ? -16 : 6);

          ctx.fillStyle = '#161a1e';
          ctx.fillRect(badgeX - 4, badgeY, textWidth + 8, 14);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(badgeX - 4, badgeY, textWidth + 8, 14);

          ctx.fillStyle = color;
          ctx.fillText(badgeText, badgeX, badgeY + 10);
        }
      });
    }

    // 6. Draw Liquidity Pools (EQH / EQL, BSL / SSL)
    if (config.showLiquidityPools && smcState.liquidityPools) {
      smcState.liquidityPools.forEach((pool) => {
        const y = series.priceToCoordinate(pool.price);
        if (y === null) return;

        const isHigh = pool.type === 'EQH' || pool.type === 'BSL';
        const color = '#38bdf8';

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rightmostX, y);
        ctx.stroke();
        ctx.setLineDash([]);

        if (showBadges) {
          ctx.fillStyle = color;
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`$$$ ${pool.type} ($${pool.price.toFixed(2)})`, 14, y + (isHigh ? -4 : 12));
        }
      });
    }

    // 7. Draw Liquidity Sweeps (Turtle Soup Wick Purges)
    if (config.showLiquiditySweeps && smcState.liquiditySweeps) {
      smcState.liquiditySweeps.forEach((sweep) => {
        const x = getXForTime(sweep.sweepTime, width, timeScale);
        const targetY = series.priceToCoordinate(sweep.targetLevelPrice);
        const peakY = series.priceToCoordinate(sweep.sweepPrice);

        if (x < 0 || x > rightmostX || targetY === null || peakY === null) return;

        const isBSL = sweep.type === 'BSL_SWEEP';
        const color = '#ec4899';

        // Sweep Arc indicator
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, peakY, 6, 0, Math.PI * 2);
        ctx.stroke();

        // Target projection ray
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x, peakY);
        ctx.lineTo(x, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        if (showBadges) {
          ctx.fillStyle = color;
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`⚡ ${isBSL ? 'BSL' : 'SSL'} SWEEP`, x - 32, peakY + (isBSL ? -10 : 16));
        }
      });
    }

    // 8. Draw Major Swings (HH, HL, LH, LL)
    if (config.showSwingStructure && smcState.swings) {
      smcState.swings.forEach((swing) => {
        const x = getXForTime(swing.time, width, timeScale);
        const y = series.priceToCoordinate(swing.price);
        if (x < 0 || x > rightmostX || y === null) return;

        const isHigh = swing.type === 'HIGH';
        const color = isHigh ? '#38bdf8' : '#a855f7';

        // Swing dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Classification badge (HH, HL, LH, LL)
        if (showBadges && swing.classification !== 'UNCLEAR') {
          ctx.font = 'bold 9px monospace';
          const tw = ctx.measureText(swing.classification).width;
          const badgeY = isHigh ? y - 16 : y + 6;

          ctx.fillStyle = color;
          ctx.fillRect(x - tw / 2 - 3, badgeY, tw + 6, 12);
          ctx.fillStyle = '#0b0e11';
          ctx.fillText(swing.classification, x - tw / 2, badgeY + 9);
        }
      });
    }

    // 9. Draw Internal Swings (ih, il)
    if (config.showInternalStructure && smcState.internalSwings) {
      smcState.internalSwings.forEach((iswing) => {
        const x = getXForTime(iswing.time, width, timeScale);
        const y = series.priceToCoordinate(iswing.price);
        if (x < 0 || x > rightmostX || y === null) return;

        const isHigh = iswing.type === 'HIGH';
        ctx.strokeStyle = isHigh ? '#38bdf8' : '#a855f7';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // 10. Draw Displacement Momentum Highlights
    if (config.showDisplacement && smcState.displacementEvents) {
      smcState.displacementEvents.forEach((disp) => {
        const x = getXForTime(disp.time, width, timeScale);
        if (x < 0 || x > rightmostX) return;

        const isBull = disp.direction === 'BULLISH';
        const color = isBull ? '#2ebd85' : '#f6465d';

        if (showBadges && disp.classification === 'STRONG') {
          ctx.fillStyle = color;
          ctx.font = 'bold 8px monospace';
          ctx.fillText(`⚡DISP`, x - 14, isBull ? height - 42 : 48);
        }
      });
    }

    // 11. Draw SMC Confluence Buy / Sell Strategy Pins
    if (config.showConfluenceSignals && smcState.confluenceSignals) {
      const minScore = config.minConfluenceScore || 55;
      smcState.confluenceSignals.forEach((signal) => {
        if (signal.score < minScore) return;

        const x = getXForTime(signal.time, width, timeScale);
        if (x < 0 || x > rightmostX) return;

        const isBull = signal.direction === 'BULLISH';
        const candle = candles.find((c) => c.time === signal.time);
        if (!candle) return;

        const targetPrice = isBull ? candle.low : candle.high;
        const y = series.priceToCoordinate(targetPrice);
        if (y === null) return;

        const color = isBull ? '#2ebd85' : '#f6465d';

        // Signal Marker Pin (Triangle)
        ctx.fillStyle = color;
        ctx.beginPath();
        if (isBull) {
          ctx.moveTo(x, y + 8);
          ctx.lineTo(x - 5, y + 16);
          ctx.lineTo(x + 5, y + 16);
        } else {
          ctx.moveTo(x, y - 8);
          ctx.lineTo(x - 5, y - 16);
          ctx.lineTo(x + 5, y - 16);
        }
        ctx.closePath();
        ctx.fill();

        // Signal Tag
        if (showBadges) {
          const badgeText = `${isBull ? '▲ BUY' : '▼ SELL'} ${signal.score}`;
          ctx.font = 'bold 9px monospace';
          const tw = ctx.measureText(badgeText).width;
          const badgeY = isBull ? y + 20 : y - 28;

          ctx.fillStyle = '#161a1e';
          ctx.fillRect(x - tw / 2 - 4, badgeY, tw + 8, 14);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(x - tw / 2 - 4, badgeY, tw + 8, 14);

          ctx.fillStyle = color;
          ctx.fillText(badgeText, x - tw / 2, badgeY + 10);
        }
      });
    }
  }, [candles, smcState, config, selectedElement, getXForTime]);

  // Initialize Lightweight Charts
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e11' },
        textColor: '#848e9c',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(43, 47, 54, 0.45)', style: 1 },
        horzLines: { color: 'rgba(43, 47, 54, 0.45)', style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#f0b90b',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e2329',
        },
        horzLine: {
          color: '#f0b90b',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e2329',
        },
      },
      timeScale: {
        borderColor: '#2b2f36',
        timeVisible: true,
        secondsVisible: timeframe === '1m' || timeframe === '3m',
        barSpacing: 10,
        minBarSpacing: 4,
      },
      rightPriceScale: {
        borderColor: '#2b2f36',
        autoScale: true,
        scaleMargins: {
          top: 0.14,
          bottom: 0.18,
        },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#2ebd85',
      downColor: '#f6465d',
      borderVisible: false,
      wickUpColor: '#2ebd85',
      wickDownColor: '#f6465d',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#2b2f36',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Crosshair move handler
    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData) {
        const data = param.seriesData.get(candleSeries) as any;
        if (data) {
          setHoveredOHLC({
            time: Number(param.time),
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: 0,
          });
        }
      } else {
        setHoveredOHLC(null);
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
      requestAnimationFrame(drawOverlays);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Update Data in Chart
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    const formattedCandles = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const formattedVolume = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(46, 189, 133, 0.25)' : 'rgba(246, 70, 93, 0.25)',
    }));

    candleSeriesRef.current.setData(formattedCandles);
    volumeSeriesRef.current.setData(formattedVolume);

    // Give lightweight-charts a tick to compute scale layout
    requestAnimationFrame(drawOverlays);
    setTimeout(() => {
      requestAnimationFrame(drawOverlays);
    }, 50);
  }, [candles, drawOverlays]);

  // Subscribe to chart view changes to redraw overlays
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const redraw = () => {
      requestAnimationFrame(drawOverlays);
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
    chart.timeScale().subscribeVisibleTimeRangeChange(redraw);

    // Initial and periodic redraw to handle autoscale adjustments
    const timer = setInterval(redraw, 200);

    return () => {
      clearInterval(timer);
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(redraw);
        chart.timeScale().unsubscribeVisibleTimeRangeChange(redraw);
      } catch (e) {
        // cleanup safe
      }
    };
  }, [smcState, config, selectedElement, drawOverlays]);

  // Click handler to select SMC structures for the inspector
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    const series = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!canvas || !series || !chart) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const clickedPrice = series.coordinateToPrice(clickY);
    if (clickedPrice === null) return;

    const timeScale = chart.timeScale();
    const width = canvas.width;

    // 1. Check Order Blocks
    if (config.showOrderBlocks && smcState.orderBlocks) {
      for (const ob of smcState.orderBlocks) {
        const topY = series.priceToCoordinate(ob.high);
        const botY = series.priceToCoordinate(ob.low);
        if (topY !== null && botY !== null) {
          const minY = Math.min(topY, botY);
          const maxY = Math.max(topY, botY);
          const x1 = getXForTime(ob.openTime, width, timeScale);
          let x2 = width - 68;
          if (ob.mitigationTime) {
            x2 = getXForTime(ob.mitigationTime, width, timeScale);
          }
          if (clickY >= minY && clickY <= maxY && clickX >= x1 && clickX <= x2) {
            onSelectElement({ type: 'ORDER_BLOCK', data: ob });
            return;
          }
        }
      }
    }

    // 2. Check Fair Value Gaps
    if (config.showFVG && smcState.fvgs) {
      for (const fvg of smcState.fvgs) {
        const topY = series.priceToCoordinate(fvg.top);
        const botY = series.priceToCoordinate(fvg.bottom);
        if (topY !== null && botY !== null) {
          const minY = Math.min(topY, botY);
          const maxY = Math.max(topY, botY);
          const x1 = getXForTime(fvg.candle1Time, width, timeScale);
          let x2 = width - 68;
          if (fvg.mitigationTime) {
            x2 = getXForTime(fvg.mitigationTime, width, timeScale);
          }
          if (clickY >= minY && clickY <= maxY && clickX >= x1 && clickX <= x2) {
            onSelectElement({ type: 'FVG', data: fvg });
            return;
          }
        }
      }
    }

    // 3. Check Structure Breaks
    if (smcState.structureBreaks) {
      for (const brk of smcState.structureBreaks) {
        const y = series.priceToCoordinate(brk.levelPrice);
        if (y !== null && Math.abs(clickY - y) <= 10) {
          const x1 = getXForTime(brk.originTime, width, timeScale);
          const x2 = getXForTime(brk.breakTime, width, timeScale);
          if (clickX >= Math.min(x1, x2) && clickX <= Math.max(x1, x2) + 20) {
            onSelectElement({ type: 'BREAK', data: brk });
            return;
          }
        }
      }
    }

    // 4. Check Liquidity Pools
    if (config.showLiquidityPools && smcState.liquidityPools) {
      for (const pool of smcState.liquidityPools) {
        const y = series.priceToCoordinate(pool.price);
        if (y !== null && Math.abs(clickY - y) <= 8) {
          onSelectElement({ type: 'LIQUIDITY_POOL', data: pool });
          return;
        }
      }
    }

    // 5. Check Confluence Signals
    if (config.showConfluenceSignals && smcState.confluenceSignals) {
      for (const sig of smcState.confluenceSignals) {
        const x = getXForTime(sig.time, width, timeScale);
        if (Math.abs(clickX - x) <= 18) {
          onSelectElement({ type: 'CONFLUENCE', data: sig });
          return;
        }
      }
    }

    // Deselect if clicked empty background
    onSelectElement(null);
  };

  const handleZoomIn = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (range) {
      const mid = (range.from + range.to) / 2;
      const span = (range.to - range.from) * 0.7;
      chart.timeScale().setVisibleLogicalRange({ from: mid - span / 2, to: mid + span / 2 });
    }
  };

  const handleZoomOut = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (range) {
      const mid = (range.from + range.to) / 2;
      const span = (range.to - range.from) * 1.3;
      chart.timeScale().setVisibleLogicalRange({ from: mid - span / 2, to: mid + span / 2 });
    }
  };

  const handleResetView = () => {
    chartRef.current?.timeScale().resetTimeScale();
    chartRef.current?.timeScale().fitContent();
  };

  const activeCandle = hoveredOHLC || (candles.length > 0 ? candles[candles.length - 1] : null);

  return (
    <div
      id="tradingview-chart-wrapper"
      className={`relative w-full h-full flex flex-col bg-[#0b0e11] select-none ${
        isFullscreen ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {/* Chart Top Info Bar */}
      <div
        id="chart-header-stats"
        className="flex flex-wrap items-center justify-between px-3 py-1.5 border-b border-[#2b2f36] bg-[#161a1e] text-xs z-10 font-mono"
      >
        <div className="flex items-center space-x-3">
          <span className="font-bold text-white tracking-wide">{symbol}</span>
          <span className="px-1.5 py-0.5 rounded bg-[#2b2f36] text-[#f0b90b] font-medium text-[10px]">
            {timeframe}
          </span>
          {activeCandle && (
            <div className="flex items-center space-x-2 text-[10px] text-[#848e9c]">
              <span>
                O <span className="text-white">${activeCandle.open.toFixed(2)}</span>
              </span>
              <span>
                H <span className="text-[#2ebd85]">${activeCandle.high.toFixed(2)}</span>
              </span>
              <span>
                L <span className="text-[#f6465d]">${activeCandle.low.toFixed(2)}</span>
              </span>
              <span>
                C{' '}
                <span
                  className={
                    activeCandle.close >= activeCandle.open ? 'text-[#2ebd85]' : 'text-[#f6465d]'
                  }
                >
                  ${activeCandle.close.toFixed(2)}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {candleCountdown && (
            <div className="flex items-center space-x-1 text-[10px] text-[#848e9c] bg-[#1e2329] px-2 py-0.5 rounded border border-[#2b2f36]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2ebd85] animate-pulse" />
              <span>Close in:</span>
              <span className="text-[#f0b90b] font-bold">{candleCountdown}</span>
            </div>
          )}

          {/* Quick chart actions */}
          <button
            id="btn-zoom-in"
            onClick={handleZoomIn}
            className="p-1 rounded bg-[#1e2329] border border-[#2b2f36] text-[#848e9c] hover:text-white hover:bg-[#2b2f36] transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-zoom-out"
            onClick={handleZoomOut}
            className="p-1 rounded bg-[#1e2329] border border-[#2b2f36] text-[#848e9c] hover:text-white hover:bg-[#2b2f36] transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-reset-view"
            onClick={handleResetView}
            className="p-1 rounded bg-[#1e2329] border border-[#2b2f36] text-[#848e9c] hover:text-white hover:bg-[#2b2f36] transition-colors cursor-pointer"
            title="Reset Scale"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-fullscreen"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 rounded bg-[#1e2329] border border-[#2b2f36] text-[#848e9c] hover:text-white hover:bg-[#2b2f36] transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Chart Canvas Container */}
      <div
        className="relative flex-1 w-full h-full overflow-hidden bg-[#0b0e11]"
        onClick={handleContainerClick}
      >
        <div ref={containerRef} className="absolute inset-0 w-full h-full z-0" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* On-Chart Floating SMC Quick Controls Toolbar */}
        <div
          id="chart-smc-toolbar"
          className="absolute top-2 left-2 z-20 flex flex-col items-start space-y-1 max-w-[calc(100%-1rem)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center space-x-1 bg-[#161a1e]/90 backdrop-blur-sm border border-[#2b2f36] rounded p-1 shadow-lg text-[11px] font-sans">
            {/* Master Toggle Button */}
            <button
              id="btn-master-toggle-smc"
              onClick={toggleAllLayers}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded font-semibold text-[10px] transition-colors cursor-pointer ${
                areAllLayersActive
                  ? 'bg-[#f0b90b] text-[#0b0e11]'
                  : 'bg-[#2b2f36] text-[#848e9c] hover:text-white'
              }`}
              title={areAllLayersActive ? 'Hide All SMC Overlays' : 'Show All SMC Overlays'}
            >
              {areAllLayersActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>{areAllLayersActive ? 'SMC Active' : 'SMC Hidden'}</span>
            </button>

            <span className="h-3.5 w-px bg-[#2b2f36]" />

            {/* Quick Toggle Chips for Individual SMC Events */}
            {isToolbarExpanded && (
              <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none py-0.5">
                {/* BOS / CHoCH Break of Structure */}
                <button
                  id="chip-toggle-breaks"
                  onClick={() => {
                    if (!onConfigChange) return;
                    const nextState = !(config.showBOS && config.showCHoCH);
                    onConfigChange({
                      ...config,
                      showBOS: nextState,
                      showCHoCH: nextState,
                      showMSS: nextState,
                    });
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap cursor-pointer ${
                    config.showBOS || config.showCHoCH
                      ? 'bg-[#1e2329] text-[#2ebd85] border border-[#2ebd85]/40 font-bold'
                      : 'bg-[#1e2329] text-[#5e6673] border border-[#2b2f36] line-through'
                  }`}
                  title="Toggle Break of Structure (BOS) & Change of Character (CHoCH)"
                >
                  BOS/CHoCH
                </button>

                {/* Order Blocks */}
                <button
                  id="chip-toggle-ob"
                  onClick={() => toggleIndividualConfig('showOrderBlocks')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap flex items-center space-x-1 cursor-pointer ${
                    config.showOrderBlocks
                      ? 'bg-[#1e2329] text-[#2ebd85] border border-[#2ebd85]/40 font-bold'
                      : 'bg-[#1e2329] text-[#5e6673] border border-[#2b2f36] line-through'
                  }`}
                  title="Toggle Order Blocks (Supply & Demand)"
                >
                  <span>OB</span>
                  {smcState.orderBlocks.length > 0 && (
                    <span className="text-[9px] opacity-75">({smcState.orderBlocks.length})</span>
                  )}
                </button>

                {/* Fair Value Gaps */}
                <button
                  id="chip-toggle-fvg"
                  onClick={() => toggleIndividualConfig('showFVG')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap flex items-center space-x-1 cursor-pointer ${
                    config.showFVG
                      ? 'bg-[#1e2329] text-[#38bdf8] border border-[#38bdf8]/40 font-bold'
                      : 'bg-[#1e2329] text-[#5e6673] border border-[#2b2f36] line-through'
                  }`}
                  title="Toggle Fair Value Gaps (FVG)"
                >
                  <span>FVG</span>
                  {smcState.fvgs.length > 0 && (
                    <span className="text-[9px] opacity-75">({smcState.fvgs.length})</span>
                  )}
                </button>

                {/* Liquidity Pools ($$$) */}
                <button
                  id="chip-toggle-liquidity"
                  onClick={() => toggleIndividualConfig('showLiquidityPools')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap cursor-pointer ${
                    config.showLiquidityPools
                      ? 'bg-[#1e2329] text-[#38bdf8] border border-[#38bdf8]/40 font-bold'
                      : 'bg-[#1e2329] text-[#5e6673] border border-[#2b2f36] line-through'
                  }`}
                  title="Toggle Equal Highs / Lows ($$$ Liquidity)"
                >
                  $$$ Pools
                </button>

                {/* Liquidity Sweeps */}
                <button
                  id="chip-toggle-sweeps"
                  onClick={() => toggleIndividualConfig('showLiquiditySweeps')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap cursor-pointer ${
                    config.showLiquiditySweeps
                      ? 'bg-[#1e2329] text-[#ec4899] border border-[#ec4899]/40 font-bold'
                      : 'bg-[#1e2329] text-[#5e6673] border border-[#2b2f36] line-through'
                  }`}
                  title="Toggle Liquidity Sweeps (Turtle Soup Purges)"
                >
                  Sweeps
                </button>

                {/* Major Swings (HH / LL) */}
                <button
                  id="chip-toggle-swings"
                  onClick={() => toggleIndividualConfig('showSwingStructure')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap cursor-pointer ${
                    config.showSwingStructure
                      ? 'bg-[#1e2329] text-[#a855f7] border border-[#a855f7]/40 font-bold'
                      : 'bg-[#1e2329] text-[#5e6673] border border-[#2b2f36] line-through'
                  }`}
                  title="Toggle Swing Pivots & Structure Classification (HH, HL, LH, LL)"
                >
                  HH/LL
                </button>

                {/* Dealing Range & Equilibrium */}
                <button
                  id="chip-toggle-range"
                  onClick={() => toggleIndividualConfig('showDealingRange')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap cursor-pointer ${
                    config.showDealingRange
                      ? 'bg-[#1e2329] text-[#f0b90b] border border-[#f0b90b]/40 font-bold'
                      : 'bg-[#1e2329] text-[#5e6673] border border-[#2b2f36] line-through'
                  }`}
                  title="Toggle Dealing Range & Equilibrium (50%)"
                >
                  EQ/Range
                </button>

                {/* Confluence Buy / Sell Signals */}
                <button
                  id="chip-toggle-signals"
                  onClick={() => toggleIndividualConfig('showConfluenceSignals')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap cursor-pointer ${
                    config.showConfluenceSignals
                      ? 'bg-[#1e2329] text-[#2ebd85] border border-[#2ebd85]/40 font-bold'
                      : 'bg-[#1e2329] text-[#5e6673] border border-[#2b2f36] line-through'
                  }`}
                  title="Toggle High Confluence Buy / Sell Strategy Signals"
                >
                  Signals
                </button>

                {/* Key Levels (PDH / PDL) */}
                <button
                  id="chip-toggle-keylevels"
                  onClick={() => toggleIndividualConfig('showPDH_PDL')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap cursor-pointer ${
                    config.showPDH_PDL
                      ? 'bg-[#1e2329] text-[#848e9c] border border-[#848e9c]/40 font-bold'
                      : 'bg-[#1e2329] text-[#5e6673] border border-[#2b2f36] line-through'
                  }`}
                  title="Toggle Previous Day High & Low (PDH/PDL)"
                >
                  PDH/PDL
                </button>

                {/* Badges / Text Labels */}
                <button
                  id="chip-toggle-badges"
                  onClick={() => toggleIndividualConfig('showEventBadges')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors whitespace-nowrap cursor-pointer ${
                    config.showEventBadges !== false
                      ? 'bg-[#2b2f36] text-white font-bold'
                      : 'bg-[#1e2329] text-[#5e6673] line-through'
                  }`}
                  title="Toggle on-chart text badges and tags"
                >
                  Labels
                </button>
              </div>
            )}

            {/* Collapse / Expand Toolbar Button */}
            <button
              id="btn-collapse-smc-toolbar"
              onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
              className="p-1 rounded text-[#848e9c] hover:text-white transition-colors cursor-pointer"
              title={isToolbarExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
            >
              {isToolbarExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Selected Element Floating Badge */}
        {selectedElement && (
          <div
            id="selected-smc-badge"
            className="absolute bottom-4 left-4 bg-[#161a1e]/95 border border-[#f0b90b] rounded px-3 py-1.5 shadow-xl text-xs flex items-center space-x-2.5 z-20 animate-in fade-in zoom-in-95 duration-100"
          >
            <span className="w-2 h-2 rounded-full bg-[#f0b90b] animate-ping" />
            <div className="flex flex-col">
              <span className="font-bold text-white text-[11px]">
                Selected {selectedElement.type.replace('_', ' ')}
              </span>
              <span className="text-[10px] text-[#848e9c]">Click to inspect rationale</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectElement(null);
              }}
              className="p-1 rounded text-[#848e9c] hover:text-white font-bold ml-2 hover:bg-[#2b2f36] cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
