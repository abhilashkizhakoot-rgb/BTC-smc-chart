import {
  Candle,
  SwingPoint,
  StructureBreak,
  OrderBlock,
  FairValueGap,
  LiquidityPool,
  LiquiditySweep,
  DisplacementEvent,
  DealingRange,
  PreviousHighLow,
  ConfluenceSignal,
  SMCConfig,
  SMCState,
  Direction,
  StructureBreakType,
} from '../types/smc';

export const DEFAULT_SMC_CONFIG: SMCConfig = {
  showSwingStructure: true,
  showInternalStructure: true,
  swingPivotLookback: 5,
  internalPivotLookback: 3,
  atrPeriod: 14,
  swingAtrFilter: 0.5,

  showBOS: true,
  showCHoCH: true,
  showMSS: true,
  bosConfirmation: 'CLOSE',

  showOrderBlocks: true,
  obMitigationRule: 'TOUCH',
  showInvalidatedOBs: false,
  maxHistoricalOBs: 20,

  showFVG: true,
  fvgMinAtrRatio: 0.25,
  fvgMitigationRule: 'TOUCH',
  showFilledFVGs: false,
  maxHistoricalFVGs: 25,

  showLiquidityPools: true,
  showLiquiditySweeps: true,
  eqhTolerancePercent: 0.08,

  showDealingRange: true,
  showOTE: true,

  showPDH_PDL: true,
  showPWH_PWL: true,

  showDisplacement: true,
  displacementThreshold: 1.2,
  showConfluenceSignals: true,
  minConfluenceScore: 55,

  showEventBadges: true,
  theme: 'dark',
  maxZonesToRender: 40,
};

/**
 * Calculates Average True Range (ATR) across candles
 */
export function calculateATR(candles: Candle[], period: number = 14): number[] {
  if (candles.length === 0) return [];
  const atrs: number[] = new Array(candles.length).fill(0);
  const trs: number[] = new Array(candles.length).fill(0);

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      trs[i] = c.high - c.low;
      atrs[i] = trs[i];
      continue;
    }
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
    trs[i] = tr;

    if (i < period) {
      const sum = trs.slice(0, i + 1).reduce((a, b) => a + b, 0);
      atrs[i] = sum / (i + 1);
    } else {
      atrs[i] = (atrs[i - 1] * (period - 1) + tr) / period;
    }
  }
  return atrs;
}

/**
 * Displacement Detector
 */
export function detectDisplacements(
  candles: Candle[],
  atrs: number[],
  threshold: number = 1.2
): DisplacementEvent[] {
  const events: DisplacementEvent[] = [];
  if (candles.length < 5) return events;

  for (let i = 4; i < candles.length; i++) {
    const c = candles[i];
    const body = Math.abs(c.close - c.open);
    const atr = atrs[i] || (c.high - c.low);
    const bodyToATR = atr > 0 ? body / atr : 0;

    // Recent 5 candles average body
    const recentBodies = [
      Math.abs(candles[i - 1].close - candles[i - 1].open),
      Math.abs(candles[i - 2].close - candles[i - 2].open),
      Math.abs(candles[i - 3].close - candles[i - 3].open),
      Math.abs(candles[i - 4].close - candles[i - 4].open),
    ];
    const avgRecent = recentBodies.reduce((a, b) => a + b, 0) / 4 || 1;
    const bodyToRecentAvg = body / avgRecent;

    // Volume expansion
    const recentVol = (candles[i - 1].volume + candles[i - 2].volume + candles[i - 3].volume) / 3 || 1;
    const volumeExpansion = c.volume / recentVol;

    const isBullish = c.close > c.open;
    const score = Number(((bodyToATR * 0.45) + (bodyToRecentAvg * 0.35) + (volumeExpansion * 0.2)).toFixed(2));

    if (bodyToATR >= threshold || (bodyToRecentAvg >= 2.0 && volumeExpansion >= 1.3)) {
      let classification: 'WEAK' | 'MODERATE' | 'STRONG' = 'WEAK';
      if (score >= 2.5 || bodyToATR >= 2.0) classification = 'STRONG';
      else if (score >= 1.6 || bodyToATR >= 1.4) classification = 'MODERATE';

      events.push({
        candleIndex: i,
        time: c.time,
        direction: isBullish ? 'BULLISH' : 'BEARISH',
        score,
        bodyToATR: Number(bodyToATR.toFixed(2)),
        bodyToRecentAvg: Number(bodyToRecentAvg.toFixed(2)),
        volumeExpansion: Number(volumeExpansion.toFixed(2)),
        classification,
      });
    }
  }
  return events;
}

/**
 * Detect Swing Points with strict zero look-ahead bias
 */
export function detectSwingPoints(
  candles: Candle[],
  lookback: number,
  structureType: 'SWING' | 'INTERNAL',
  atrs: number[],
  atrFilterMult: number = 0.4
): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (candles.length < lookback * 2 + 1) return swings;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const target = candles[i];
    const atr = atrs[i] || 1;
    const minDistance = atr * atrFilterMult;

    // Check Swing High
    let isHigh = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= target.high) {
        isHigh = false;
        break;
      }
    }

    if (isHigh) {
      const confirmedIndex = i + lookback;
      const confirmedTime = candles[confirmedIndex].time;
      swings.push({
        id: `${structureType}_H_${i}_${target.time}`,
        type: 'HIGH',
        structureType,
        price: target.high,
        time: target.time,
        candleIndex: i,
        confirmedTime,
        confirmedIndex,
        classification: 'UNCLEAR',
        broken: false,
        swept: false,
      });
    }

    // Check Swing Low
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].low <= target.low) {
        isLow = false;
        break;
      }
    }

    if (isLow) {
      const confirmedIndex = i + lookback;
      const confirmedTime = candles[confirmedIndex].time;
      swings.push({
        id: `${structureType}_L_${i}_${target.time}`,
        type: 'LOW',
        structureType,
        price: target.low,
        time: target.time,
        candleIndex: i,
        confirmedTime,
        confirmedIndex,
        classification: 'UNCLEAR',
        broken: false,
        swept: false,
      });
    }
  }

  // Sort chronologically
  swings.sort((a, b) => a.candleIndex - b.candleIndex);

  // Classify HH, HL, LH, LL
  let lastHigh: SwingPoint | null = null;
  let lastLow: SwingPoint | null = null;

  for (const s of swings) {
    if (s.type === 'HIGH') {
      if (!lastHigh) {
        s.classification = 'HH';
      } else {
        s.classification = s.price > lastHigh.price ? 'HH' : 'LH';
      }
      lastHigh = s;
    } else {
      if (!lastLow) {
        s.classification = 'HL';
      } else {
        s.classification = s.price > lastLow.price ? 'HL' : 'LL';
      }
      lastLow = s;
    }
  }

  return swings;
}

/**
 * Detects Fair Value Gaps (FVG) and tracks mitigation
 */
export function detectFairValueGaps(
  candles: Candle[],
  atrs: number[],
  minAtrRatio: number = 0.25,
  rule: 'TOUCH' | 'FILL_50' | 'FULL_FILL' = 'TOUCH'
): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  if (candles.length < 3) return fvgs;

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];
    const atr = atrs[i - 1] || (c2.high - c2.low);

    // Bullish FVG: Candle 1 High < Candle 3 Low
    if (c3.low > c1.high) {
      const gapSize = c3.low - c1.high;
      const sizeATR = atr > 0 ? gapSize / atr : 0;

      if (sizeATR >= minAtrRatio) {
        const top = c3.low;
        const bottom = c1.high;
        const mid = (top + bottom) / 2;
        const sizePercent = Number(((gapSize / bottom) * 100).toFixed(3));

        const fvg: FairValueGap = {
          id: `FVG_BULL_${i - 1}_${c2.time}`,
          direction: 'BULLISH',
          top,
          bottom,
          mid,
          candle1Time: c1.time,
          candle2Time: c2.time,
          candle3Time: c3.time,
          candleIndex: i - 1,
          status: 'FRESH',
          fillPercentage: 0,
          sizeATR: Number(sizeATR.toFixed(2)),
          sizePercent,
          confluenceScore: Math.min(100, Math.round(50 + sizeATR * 25)),
          rationale: `Bullish 3-candle imbalance. Candle #1 high (${c1.high.toFixed(2)}) leaves open price gap before Candle #3 low (${c3.low.toFixed(2)}) with ${sizeATR.toFixed(2)}x ATR displacement.`,
        };

        // Check mitigation in future candles
        for (let k = i + 1; k < candles.length; k++) {
          const futureCandle = candles[k];
          if (futureCandle.low <= top) {
            // Price entered the gap
            const penetration = Math.max(0, top - futureCandle.low);
            const fillPct = Math.min(100, (penetration / gapSize) * 100);
            fvg.fillPercentage = Math.max(fvg.fillPercentage, Number(fillPct.toFixed(1)));

            if (rule === 'TOUCH' && futureCandle.low <= top) {
              fvg.status = 'MITIGATED';
              fvg.mitigationTime = futureCandle.time;
              fvg.mitigationIndex = k;
              break;
            } else if (rule === 'FILL_50' && futureCandle.low <= mid) {
              fvg.status = 'MITIGATED';
              fvg.mitigationTime = futureCandle.time;
              fvg.mitigationIndex = k;
              break;
            } else if (rule === 'FULL_FILL' && futureCandle.low <= bottom) {
              fvg.status = 'MITIGATED';
              fvg.mitigationTime = futureCandle.time;
              fvg.mitigationIndex = k;
              break;
            } else {
              fvg.status = 'PARTIALLY_FILLED';
            }
          }
          // Invalidation if closed below bottom
          if (futureCandle.close < bottom) {
            fvg.status = 'INVALIDATED';
            fvg.mitigationTime = futureCandle.time;
            fvg.mitigationIndex = k;
            break;
          }
        }

        fvgs.push(fvg);
      }
    }

    // Bearish FVG: Candle 1 Low > Candle 3 High
    if (c1.low > c3.high) {
      const gapSize = c1.low - c3.high;
      const sizeATR = atr > 0 ? gapSize / atr : 0;

      if (sizeATR >= minAtrRatio) {
        const top = c1.low;
        const bottom = c3.high;
        const mid = (top + bottom) / 2;
        const sizePercent = Number(((gapSize / bottom) * 100).toFixed(3));

        const fvg: FairValueGap = {
          id: `FVG_BEAR_${i - 1}_${c2.time}`,
          direction: 'BEARISH',
          top,
          bottom,
          mid,
          candle1Time: c1.time,
          candle2Time: c2.time,
          candle3Time: c3.time,
          candleIndex: i - 1,
          status: 'FRESH',
          fillPercentage: 0,
          sizeATR: Number(sizeATR.toFixed(2)),
          sizePercent,
          confluenceScore: Math.min(100, Math.round(50 + sizeATR * 25)),
          rationale: `Bearish 3-candle imbalance. Candle #1 low (${c1.low.toFixed(2)}) leaves open price gap before Candle #3 high (${c3.high.toFixed(2)}) with ${sizeATR.toFixed(2)}x ATR displacement.`,
        };

        // Check mitigation in future candles
        for (let k = i + 1; k < candles.length; k++) {
          const futureCandle = candles[k];
          if (futureCandle.high >= bottom) {
            const penetration = Math.max(0, futureCandle.high - bottom);
            const fillPct = Math.min(100, (penetration / gapSize) * 100);
            fvg.fillPercentage = Math.max(fvg.fillPercentage, Number(fillPct.toFixed(1)));

            if (rule === 'TOUCH' && futureCandle.high >= bottom) {
              fvg.status = 'MITIGATED';
              fvg.mitigationTime = futureCandle.time;
              fvg.mitigationIndex = k;
              break;
            } else if (rule === 'FILL_50' && futureCandle.high >= mid) {
              fvg.status = 'MITIGATED';
              fvg.mitigationTime = futureCandle.time;
              fvg.mitigationIndex = k;
              break;
            } else if (rule === 'FULL_FILL' && futureCandle.high >= top) {
              fvg.status = 'MITIGATED';
              fvg.mitigationTime = futureCandle.time;
              fvg.mitigationIndex = k;
              break;
            } else {
              fvg.status = 'PARTIALLY_FILLED';
            }
          }
          if (futureCandle.close > top) {
            fvg.status = 'INVALIDATED';
            fvg.mitigationTime = futureCandle.time;
            fvg.mitigationIndex = k;
            break;
          }
        }

        fvgs.push(fvg);
      }
    }
  }

  return fvgs;
}

/**
 * Detects Liquidity Pools (EQH, EQL, BSL, SSL) and Liquidity Sweeps
 */
export function detectLiquidity(
  candles: Candle[],
  swings: SwingPoint[],
  atrs: number[],
  tolerancePercent: number = 0.08
): { pools: LiquidityPool[]; sweeps: LiquiditySweep[] } {
  const pools: LiquidityPool[] = [];
  const sweeps: LiquiditySweep[] = [];

  const highs = swings.filter((s) => s.type === 'HIGH');
  const lows = swings.filter((s) => s.type === 'LOW');

  // Detect Equal Highs (EQH)
  for (let i = 0; i < highs.length; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      const h1 = highs[i];
      const h2 = highs[j];
      if (h2.candleIndex - h1.candleIndex < 3) continue; // must be separated
      const diffPct = Math.abs(h1.price - h2.price) / h1.price * 100;

      if (diffPct <= tolerancePercent) {
        const avgPrice = (h1.price + h2.price) / 2;
        pools.push({
          id: `EQH_${h1.id}_${h2.id}`,
          type: 'EQH',
          price: avgPrice,
          timeRange: [h1.time, h2.time],
          swingIds: [h1.id, h2.id],
          tolerance: Number(diffPct.toFixed(3)),
          status: 'ACTIVE',
          rationale: `Equal Highs within ${diffPct.toFixed(3)}% tolerance. Resting buy-side liquidity pool above $${avgPrice.toFixed(2)}.`,
        });
      }
    }
  }

  // Detect Equal Lows (EQL)
  for (let i = 0; i < lows.length; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      const l1 = lows[i];
      const l2 = lows[j];
      if (l2.candleIndex - l1.candleIndex < 3) continue;
      const diffPct = Math.abs(l1.price - l2.price) / l1.price * 100;

      if (diffPct <= tolerancePercent) {
        const avgPrice = (l1.price + l2.price) / 2;
        pools.push({
          id: `EQL_${l1.id}_${l2.id}`,
          type: 'EQL',
          price: avgPrice,
          timeRange: [l1.time, l2.time],
          swingIds: [l1.id, l2.id],
          tolerance: Number(diffPct.toFixed(3)),
          status: 'ACTIVE',
          rationale: `Equal Lows within ${diffPct.toFixed(3)}% tolerance. Resting sell-side liquidity pool below $${avgPrice.toFixed(2)}.`,
        });
      }
    }
  }

  // Detect Sweeps against Highs & Lows
  for (const s of swings) {
    const startIndex = s.confirmedIndex;
    for (let k = startIndex; k < Math.min(candles.length, startIndex + 50); k++) {
      const candle = candles[k];

      if (s.type === 'HIGH') {
        // Price traded above high (wick sweep), but candle closed BACK BELOW the high
        if (candle.high > s.price && candle.close < s.price) {
          const atr = atrs[k] || 1;
          const sweepDepth = candle.high - s.price;
          const displacementScore = sweepDepth / atr;

          sweeps.push({
            id: `SWEEP_BSL_${s.id}_${k}`,
            type: 'BSL_SWEEP',
            targetLevelPrice: s.price,
            sweepPrice: candle.high,
            sweepTime: candle.time,
            sweepIndex: k,
            confirmationTime: candle.time,
            displacementScore: Number(displacementScore.toFixed(2)),
            rationale: `Buy-Side Liquidity (BSL) swept at $${s.price.toFixed(2)}. High reached $${candle.high.toFixed(2)} (+${sweepDepth.toFixed(2)}) but rejected and closed inside ($${candle.close.toFixed(2)}).`,
          });

          s.swept = true;
          s.sweptTime = candle.time;
          break;
        }
      } else if (s.type === 'LOW') {
        // Price traded below low (wick sweep), but candle closed BACK ABOVE the low
        if (candle.low < s.price && candle.close > s.price) {
          const atr = atrs[k] || 1;
          const sweepDepth = s.price - candle.low;
          const displacementScore = sweepDepth / atr;

          sweeps.push({
            id: `SWEEP_SSL_${s.id}_${k}`,
            type: 'SSL_SWEEP',
            targetLevelPrice: s.price,
            sweepPrice: candle.low,
            sweepTime: candle.time,
            sweepIndex: k,
            confirmationTime: candle.time,
            displacementScore: Number(displacementScore.toFixed(2)),
            rationale: `Sell-Side Liquidity (SSL) swept at $${s.price.toFixed(2)}. Low reached $${candle.low.toFixed(2)} (-${sweepDepth.toFixed(2)}) but rejected and closed above ($${candle.close.toFixed(2)}).`,
          });

          s.swept = true;
          s.sweptTime = candle.time;
          break;
        }
      }
    }
  }

  return { pools, sweeps };
}

/**
 * Detects BOS (Break of Structure), CHoCH (Change of Character), and MSS (Market Structure Shift)
 */
export function detectStructureBreaks(
  candles: Candle[],
  swings: SwingPoint[],
  displacements: DisplacementEvent[],
  sweeps: LiquiditySweep[],
  confirmationType: 'CLOSE' | 'WICK' | 'DISPLACEMENT' = 'CLOSE'
): {
  breaks: StructureBreak[];
  activeBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  protectedHigh?: SwingPoint;
  protectedLow?: SwingPoint;
  lastBOS?: StructureBreak;
  lastCHoCH?: StructureBreak;
} {
  const breaks: StructureBreak[] = [];
  let currentTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let protectedHigh: SwingPoint | undefined;
  let protectedLow: SwingPoint | undefined;
  let lastBOS: StructureBreak | undefined;
  let lastCHoCH: StructureBreak | undefined;

  // Track active unbroken swings
  const activeSwings = [...swings];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    // Swings confirmed up to this candle
    const availableSwings = activeSwings.filter(
      (s) => s.confirmedIndex <= i && !s.broken
    );

    const availableHighs = availableSwings.filter((s) => s.type === 'HIGH');
    const availableLows = availableSwings.filter((s) => s.type === 'LOW');

    // Check Bullish Break
    for (const h of availableHighs) {
      let isBreak = false;
      if (confirmationType === 'CLOSE' && candle.close > h.price) isBreak = true;
      else if (confirmationType === 'WICK' && candle.high > h.price) isBreak = true;
      else if (confirmationType === 'DISPLACEMENT' && candle.close > h.price) {
        const hasDisp = displacements.some((d) => d.candleIndex === i && d.direction === 'BULLISH');
        if (hasDisp) isBreak = true;
      }

      if (isBreak) {
        h.broken = true;
        h.brokenTime = candle.time;
        h.brokenPrice = candle.close;

        const isBOS = currentTrend === 'BULLISH';
        const isCHoCH = currentTrend === 'BEARISH';
        const hasSweepPreceding = sweeps.some(
          (sw) => sw.type === 'SSL_SWEEP' && sw.sweepIndex >= i - 10 && sw.sweepIndex <= i
        );
        const hasStrongDisp = displacements.some(
          (d) => d.candleIndex === i && d.classification === 'STRONG'
        );
        const isMSS = isCHoCH && (hasSweepPreceding || hasStrongDisp);

        const breakType: StructureBreakType = isMSS ? 'MSS' : isCHoCH ? 'CHoCH' : 'BOS';

        const structureBreak: StructureBreak = {
          id: `BREAK_${breakType}_${h.id}_${candle.time}`,
          type: breakType,
          direction: 'BULLISH',
          levelPrice: h.price,
          originSwingId: h.id,
          originTime: h.time,
          breakTime: candle.time,
          breakIndex: i,
          confirmationTime: candle.time,
          confirmationType,
          displacementScore: 1.5,
          rationale: `${breakType} Bullish structure break. Price broke above previous Swing High ($${h.price.toFixed(2)}) confirmed via ${confirmationType}. ${
            isCHoCH ? 'Shifted trend from Bearish to Bullish.' : 'Continuation of Bullish trend.'
          }`,
        };

        breaks.push(structureBreak);
        if (breakType === 'BOS') lastBOS = structureBreak;
        if (breakType === 'CHoCH' || breakType === 'MSS') {
          lastCHoCH = structureBreak;
          currentTrend = 'BULLISH';
        } else if (currentTrend === 'NEUTRAL') {
          currentTrend = 'BULLISH';
        }

        // Update Protected Low
        const recentLows = availableLows.filter((l) => l.candleIndex < i);
        if (recentLows.length > 0) {
          protectedLow = recentLows[recentLows.length - 1];
        }
      }
    }

    // Check Bearish Break
    for (const l of availableLows) {
      let isBreak = false;
      if (confirmationType === 'CLOSE' && candle.close < l.price) isBreak = true;
      else if (confirmationType === 'WICK' && candle.low < l.price) isBreak = true;
      else if (confirmationType === 'DISPLACEMENT' && candle.close < l.price) {
        const hasDisp = displacements.some((d) => d.candleIndex === i && d.direction === 'BEARISH');
        if (hasDisp) isBreak = true;
      }

      if (isBreak) {
        l.broken = true;
        l.brokenTime = candle.time;
        l.brokenPrice = candle.close;

        const isBOS = currentTrend === 'BEARISH';
        const isCHoCH = currentTrend === 'BULLISH';
        const hasSweepPreceding = sweeps.some(
          (sw) => sw.type === 'BSL_SWEEP' && sw.sweepIndex >= i - 10 && sw.sweepIndex <= i
        );
        const hasStrongDisp = displacements.some(
          (d) => d.candleIndex === i && d.classification === 'STRONG'
        );
        const isMSS = isCHoCH && (hasSweepPreceding || hasStrongDisp);

        const breakType: StructureBreakType = isMSS ? 'MSS' : isCHoCH ? 'CHoCH' : 'BOS';

        const structureBreak: StructureBreak = {
          id: `BREAK_${breakType}_${l.id}_${candle.time}`,
          type: breakType,
          direction: 'BEARISH',
          levelPrice: l.price,
          originSwingId: l.id,
          originTime: l.time,
          breakTime: candle.time,
          breakIndex: i,
          confirmationTime: candle.time,
          confirmationType,
          displacementScore: 1.5,
          rationale: `${breakType} Bearish structure break. Price broke below previous Swing Low ($${l.price.toFixed(2)}) confirmed via ${confirmationType}. ${
            isCHoCH ? 'Shifted trend from Bullish to Bearish.' : 'Continuation of Bearish trend.'
          }`,
        };

        breaks.push(structureBreak);
        if (breakType === 'BOS') lastBOS = structureBreak;
        if (breakType === 'CHoCH' || breakType === 'MSS') {
          lastCHoCH = structureBreak;
          currentTrend = 'BEARISH';
        } else if (currentTrend === 'NEUTRAL') {
          currentTrend = 'BEARISH';
        }

        // Update Protected High
        const recentHighs = availableHighs.filter((h) => h.candleIndex < i);
        if (recentHighs.length > 0) {
          protectedHigh = recentHighs[recentHighs.length - 1];
        }
      }
    }
  }

  return {
    breaks,
    activeBias: currentTrend,
    protectedHigh,
    protectedLow,
    lastBOS,
    lastCHoCH,
  };
}

/**
 * Detects context-aware Order Blocks originating from displacement runs
 */
export function detectOrderBlocks(
  candles: Candle[],
  breaks: StructureBreak[],
  fvgs: FairValueGap[],
  sweeps: LiquiditySweep[],
  displacements: DisplacementEvent[],
  mitigationRule: 'TOUCH' | 'CLOSE_PAST_50' | 'FULL_CLOSE' = 'TOUCH'
): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];

  for (const brk of breaks) {
    const breakIndex = brk.breakIndex;
    if (breakIndex < 2) continue;

    if (brk.direction === 'BULLISH') {
      // Find the last bearish candle before the bullish expansion
      let obIndex = -1;
      for (let k = breakIndex - 1; k >= Math.max(0, breakIndex - 8); k--) {
        if (candles[k].close < candles[k].open) {
          obIndex = k;
          break;
        }
      }
      if (obIndex === -1) obIndex = breakIndex - 1;

      const obCandle = candles[obIndex];
      const hasFVG = fvgs.some((f) => f.direction === 'BULLISH' && f.candleIndex >= obIndex && f.candleIndex <= breakIndex);
      const hasSweep = sweeps.some((s) => s.type === 'SSL_SWEEP' && s.sweepIndex >= obIndex - 4 && s.sweepIndex <= breakIndex);
      const dispEvent = displacements.find((d) => d.candleIndex >= obIndex && d.candleIndex <= breakIndex && d.direction === 'BULLISH');
      const dispStrength = dispEvent ? dispEvent.classification : 'MODERATE';

      // Score OB
      let score = 50;
      if (brk.type === 'MSS' || brk.type === 'CHoCH') score += 20;
      if (hasFVG) score += 15;
      if (hasSweep) score += 15;
      if (dispStrength === 'STRONG') score += 10;
      score = Math.min(100, score);

      const high = obCandle.high;
      const low = obCandle.low;
      const mid = (high + low) / 2;

      const ob: OrderBlock = {
        id: `OB_BULL_${obIndex}_${obCandle.time}`,
        direction: 'BULLISH',
        high,
        low,
        openTime: obCandle.time,
        closeTime: candles[breakIndex].time,
        candleIndex: obIndex,
        status: 'FRESH',
        testCount: 0,
        volume: obCandle.volume,
        displacement: dispStrength,
        displacementScore: dispEvent?.score || 1.2,
        triggerStructureType: brk.type,
        hasFVG,
        hasSweep,
        confluenceScore: score,
        rationale: `Bullish Order Block at [${low.toFixed(2)} - ${high.toFixed(2)}] created prior to ${brk.type} break at $${brk.levelPrice.toFixed(2)}. ${
          hasFVG ? 'Accompanied by bullish FVG imbalance. ' : ''
        }${hasSweep ? 'Followed SSL liquidity sweep. ' : ''}Displacement: ${dispStrength}.`,
      };

      // Forward mitigation tracking
      for (let m = breakIndex + 1; m < candles.length; m++) {
        const testCandle = candles[m];
        if (testCandle.low <= high && testCandle.high >= low) {
          ob.testCount++;
          if (ob.status === 'FRESH') ob.status = 'TESTED';

          if (mitigationRule === 'TOUCH') {
            ob.status = 'MITIGATED';
            ob.mitigationTime = testCandle.time;
            ob.mitigationIndex = m;
            break;
          } else if (mitigationRule === 'CLOSE_PAST_50' && testCandle.close < mid) {
            ob.status = 'MITIGATED';
            ob.mitigationTime = testCandle.time;
            ob.mitigationIndex = m;
            break;
          }
        }
        if (testCandle.close < low) {
          ob.status = 'INVALIDATED';
          ob.mitigationTime = testCandle.time;
          ob.mitigationIndex = m;
          break;
        }
      }

      orderBlocks.push(ob);
    } else {
      // Find the last bullish candle before the bearish expansion
      let obIndex = -1;
      for (let k = breakIndex - 1; k >= Math.max(0, breakIndex - 8); k--) {
        if (candles[k].close > candles[k].open) {
          obIndex = k;
          break;
        }
      }
      if (obIndex === -1) obIndex = breakIndex - 1;

      const obCandle = candles[obIndex];
      const hasFVG = fvgs.some((f) => f.direction === 'BEARISH' && f.candleIndex >= obIndex && f.candleIndex <= breakIndex);
      const hasSweep = sweeps.some((s) => s.type === 'BSL_SWEEP' && s.sweepIndex >= obIndex - 4 && s.sweepIndex <= breakIndex);
      const dispEvent = displacements.find((d) => d.candleIndex >= obIndex && d.candleIndex <= breakIndex && d.direction === 'BEARISH');
      const dispStrength = dispEvent ? dispEvent.classification : 'MODERATE';

      let score = 50;
      if (brk.type === 'MSS' || brk.type === 'CHoCH') score += 20;
      if (hasFVG) score += 15;
      if (hasSweep) score += 15;
      if (dispStrength === 'STRONG') score += 10;
      score = Math.min(100, score);

      const high = obCandle.high;
      const low = obCandle.low;
      const mid = (high + low) / 2;

      const ob: OrderBlock = {
        id: `OB_BEAR_${obIndex}_${obCandle.time}`,
        direction: 'BEARISH',
        high,
        low,
        openTime: obCandle.time,
        closeTime: candles[breakIndex].time,
        candleIndex: obIndex,
        status: 'FRESH',
        testCount: 0,
        volume: obCandle.volume,
        displacement: dispStrength,
        displacementScore: dispEvent?.score || 1.2,
        triggerStructureType: brk.type,
        hasFVG,
        hasSweep,
        confluenceScore: score,
        rationale: `Bearish Order Block at [${low.toFixed(2)} - ${high.toFixed(2)}] created prior to ${brk.type} break at $${brk.levelPrice.toFixed(2)}. ${
          hasFVG ? 'Accompanied by bearish FVG imbalance. ' : ''
        }${hasSweep ? 'Followed BSL liquidity sweep. ' : ''}Displacement: ${dispStrength}.`,
      };

      // Forward mitigation tracking
      for (let m = breakIndex + 1; m < candles.length; m++) {
        const testCandle = candles[m];
        if (testCandle.high >= low && testCandle.low <= high) {
          ob.testCount++;
          if (ob.status === 'FRESH') ob.status = 'TESTED';

          if (mitigationRule === 'TOUCH') {
            ob.status = 'MITIGATED';
            ob.mitigationTime = testCandle.time;
            ob.mitigationIndex = m;
            break;
          } else if (mitigationRule === 'CLOSE_PAST_50' && testCandle.close > mid) {
            ob.status = 'MITIGATED';
            ob.mitigationTime = testCandle.time;
            ob.mitigationIndex = m;
            break;
          }
        }
        if (testCandle.close > high) {
          ob.status = 'INVALIDATED';
          ob.mitigationTime = testCandle.time;
          ob.mitigationIndex = m;
          break;
        }
      }

      orderBlocks.push(ob);
    }
  }

  // Return deduplicated OBs
  return orderBlocks;
}

/**
 * Calculates current Dealing Range (Premium / Discount / Equilibrium / OTE)
 */
export function calculateDealingRange(
  candles: Candle[],
  swings: SwingPoint[]
): DealingRange | undefined {
  if (swings.length < 2 || candles.length === 0) return undefined;

  const swingHighs = swings.filter((s) => s.type === 'HIGH');
  const swingLows = swings.filter((s) => s.type === 'LOW');

  if (swingHighs.length === 0 || swingLows.length === 0) return undefined;

  const recentHigh = swingHighs[swingHighs.length - 1];
  const recentLow = swingLows[swingLows.length - 1];

  const high = Math.max(recentHigh.price, recentLow.price);
  const low = Math.min(recentHigh.price, recentLow.price);
  const range = high - low;
  if (range <= 0) return undefined;

  const equilibrium = low + range * 0.5;
  const currentPrice = candles[candles.length - 1].close;

  let currentZone: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM' = 'EQUILIBRIUM';
  if (currentPrice > equilibrium * 1.001) currentZone = 'PREMIUM';
  else if (currentPrice < equilibrium * 0.999) currentZone = 'DISCOUNT';

  // Optimal Trade Entry: 61.8% to 78.6% retracement from high in discount or from low in premium
  const oteTop = low + range * 0.786;
  const oteBottom = low + range * 0.618;

  return {
    high,
    low,
    highTime: recentHigh.time,
    lowTime: recentLow.time,
    equilibrium,
    premiumZone: [equilibrium, high],
    discountZone: [low, equilibrium],
    oteZone: [oteBottom, oteTop],
    currentZone,
  };
}

/**
 * Calculate Previous Day / Week High & Low levels
 */
export function calculatePreviousHighLow(candles: Candle[]): PreviousHighLow {
  if (candles.length < 24) {
    return { pdhSwept: false, pdlSwept: false, pwhSwept: false, pwlSwept: false };
  }

  // Estimate last 24h as daily
  const dayCandles = candles.slice(-288); // 24h of 5m candles
  let pdh = -Infinity;
  let pdl = Infinity;
  for (const c of dayCandles) {
    if (c.high > pdh) pdh = c.high;
    if (c.low < pdl) pdl = c.low;
  }

  const currentPrice = candles[candles.length - 1].close;
  const currentHigh = candles[candles.length - 1].high;
  const currentLow = candles[candles.length - 1].low;

  return {
    pdh,
    pdl,
    pdhSwept: currentHigh > pdh && currentPrice < pdh,
    pdlSwept: currentLow < pdl && currentPrice > pdl,
    pwhSwept: false,
    pwlSwept: false,
  };
}

/**
 * Confluence Engine: Computes a multi-factor score (0-100)
 */
export function calculateConfluenceSignals(
  candles: Candle[],
  breaks: StructureBreak[],
  orderBlocks: OrderBlock[],
  fvgs: FairValueGap[],
  sweeps: LiquiditySweep[],
  dealingRange?: DealingRange
): ConfluenceSignal[] {
  const signals: ConfluenceSignal[] = [];
  if (candles.length < 5) return signals;

  const lastCandle = candles[candles.length - 1];
  const lastTime = lastCandle.time;
  const lastIndex = candles.length - 1;

  // Check Bullish Confluence
  let bullScore = 0;
  const bullFactors: ConfluenceSignal['factors'] = [];

  const recentSSLSweep = sweeps.find((s) => s.type === 'SSL_SWEEP' && s.sweepIndex >= lastIndex - 12);
  if (recentSSLSweep) {
    bullScore += 25;
    bullFactors.push({
      name: 'Sell-Side Liquidity Swept',
      points: 25,
      bullish: true,
      description: `Price swept SSL at $${recentSSLSweep.targetLevelPrice.toFixed(2)} and rejected.`,
    });
  }

  const recentBullBreak = breaks.find((b) => b.direction === 'BULLISH' && b.breakIndex >= lastIndex - 12);
  if (recentBullBreak) {
    const pts = recentBullBreak.type === 'MSS' ? 25 : recentBullBreak.type === 'CHoCH' ? 20 : 15;
    bullScore += pts;
    bullFactors.push({
      name: `Bullish ${recentBullBreak.type}`,
      points: pts,
      bullish: true,
      description: `Confirmed ${recentBullBreak.type} break at $${recentBullBreak.levelPrice.toFixed(2)}.`,
    });
  }

  const freshBullOB = orderBlocks.find((o) => o.direction === 'BULLISH' && o.status === 'FRESH');
  if (freshBullOB) {
    bullScore += 20;
    bullFactors.push({
      name: 'Fresh Bullish Order Block',
      points: 20,
      bullish: true,
      description: `Unmitigated demand zone active at [$${freshBullOB.low.toFixed(2)} - $${freshBullOB.high.toFixed(2)}].`,
    });
  }

  const freshBullFVG = fvgs.find((f) => f.direction === 'BULLISH' && f.status === 'FRESH');
  if (freshBullFVG) {
    bullScore += 15;
    bullFactors.push({
      name: 'Active Bullish FVG Imbalance',
      points: 15,
      bullish: true,
      description: `Open fair value gap at [$${freshBullFVG.bottom.toFixed(2)} - $${freshBullFVG.top.toFixed(2)}].`,
    });
  }

  if (dealingRange && dealingRange.currentZone === 'DISCOUNT') {
    bullScore += 15;
    bullFactors.push({
      name: 'Price in Discount Zone',
      points: 15,
      bullish: true,
      description: `Current price ($${lastCandle.close.toFixed(2)}) is below dealing equilibrium ($${dealingRange.equilibrium.toFixed(2)}).`,
    });
  }

  // Check Bearish Confluence
  let bearScore = 0;
  const bearFactors: ConfluenceSignal['factors'] = [];

  const recentBSLSweep = sweeps.find((s) => s.type === 'BSL_SWEEP' && s.sweepIndex >= lastIndex - 12);
  if (recentBSLSweep) {
    bearScore += 25;
    bearFactors.push({
      name: 'Buy-Side Liquidity Swept',
      points: 25,
      bullish: false,
      description: `Price swept BSL at $${recentBSLSweep.targetLevelPrice.toFixed(2)} and rejected.`,
    });
  }

  const recentBearBreak = breaks.find((b) => b.direction === 'BEARISH' && b.breakIndex >= lastIndex - 12);
  if (recentBearBreak) {
    const pts = recentBearBreak.type === 'MSS' ? 25 : recentBearBreak.type === 'CHoCH' ? 20 : 15;
    bearScore += pts;
    bearFactors.push({
      name: `Bearish ${recentBearBreak.type}`,
      points: pts,
      bullish: false,
      description: `Confirmed ${recentBearBreak.type} break at $${recentBearBreak.levelPrice.toFixed(2)}.`,
    });
  }

  const freshBearOB = orderBlocks.find((o) => o.direction === 'BEARISH' && o.status === 'FRESH');
  if (freshBearOB) {
    bearScore += 20;
    bearFactors.push({
      name: 'Fresh Bearish Order Block',
      points: 20,
      bullish: false,
      description: `Unmitigated supply zone active at [$${freshBearOB.low.toFixed(2)} - $${freshBearOB.high.toFixed(2)}].`,
    });
  }

  const freshBearFVG = fvgs.find((f) => f.direction === 'BEARISH' && f.status === 'FRESH');
  if (freshBearFVG) {
    bearScore += 15;
    bearFactors.push({
      name: 'Active Bearish FVG Imbalance',
      points: 15,
      bullish: false,
      description: `Open fair value gap at [$${freshBearFVG.bottom.toFixed(2)} - $${freshBearFVG.top.toFixed(2)}].`,
    });
  }

  if (dealingRange && dealingRange.currentZone === 'PREMIUM') {
    bearScore += 15;
    bearFactors.push({
      name: 'Price in Premium Zone',
      points: 15,
      bullish: false,
      description: `Current price ($${lastCandle.close.toFixed(2)}) is above dealing equilibrium ($${dealingRange.equilibrium.toFixed(2)}).`,
    });
  }

  if (bullScore >= 40) {
    let classification: ConfluenceSignal['classification'] = 'MODERATE';
    if (bullScore >= 80) classification = 'VERY_STRONG';
    else if (bullScore >= 60) classification = 'STRONG';

    signals.push({
      id: `CONF_BULL_${lastTime}`,
      time: lastTime,
      candleIndex: lastIndex,
      direction: 'BULLISH',
      score: Math.min(100, bullScore),
      classification,
      factors: bullFactors,
      primaryTrigger: bullFactors[0]?.name || 'Bullish Structure Alignment',
    });
  }

  if (bearScore >= 40) {
    let classification: ConfluenceSignal['classification'] = 'MODERATE';
    if (bearScore >= 80) classification = 'VERY_STRONG';
    else if (bearScore >= 60) classification = 'STRONG';

    signals.push({
      id: `CONF_BEAR_${lastTime}`,
      time: lastTime,
      candleIndex: lastIndex,
      direction: 'BEARISH',
      score: Math.min(100, bearScore),
      classification,
      factors: bearFactors,
      primaryTrigger: bearFactors[0]?.name || 'Bearish Structure Alignment',
    });
  }

  return signals;
}

/**
 * Master SMC Calculation Engine
 * Completely deterministic and with zero look-ahead bias
 */
export function runSMCEngine(candles: Candle[], config: SMCConfig = DEFAULT_SMC_CONFIG): SMCState {
  const debugLogs: string[] = [];
  debugLogs.push(`[SMC Engine] Processing ${candles.length} candles with pivot lookback ${config.swingPivotLookback}.`);

  if (candles.length < 10) {
    return {
      swings: [],
      internalSwings: [],
      structureBreaks: [],
      orderBlocks: [],
      fvgs: [],
      liquidityPools: [],
      liquiditySweeps: [],
      displacementEvents: [],
      prevHighLow: { pdhSwept: false, pdlSwept: false, pwhSwept: false, pwlSwept: false },
      confluenceSignals: [],
      activeBias: 'NEUTRAL',
      debugLogs,
    };
  }

  // 1. ATR
  const atrs = calculateATR(candles, config.atrPeriod);

  // 2. Displacements
  const displacementEvents = detectDisplacements(candles, atrs, config.displacementThreshold);
  debugLogs.push(`[Displacement] Found ${displacementEvents.length} displacement events.`);

  // 3. Swings (Major and Internal)
  const swings = detectSwingPoints(
    candles,
    config.swingPivotLookback,
    'SWING',
    atrs,
    config.swingAtrFilter
  );
  const internalSwings = detectSwingPoints(
    candles,
    config.internalPivotLookback,
    'INTERNAL',
    atrs,
    config.swingAtrFilter * 0.5
  );
  debugLogs.push(`[Swings] Detected ${swings.length} major swings, ${internalSwings.length} internal swings.`);

  // 4. Fair Value Gaps
  const fvgs = detectFairValueGaps(
    candles,
    atrs,
    config.fvgMinAtrRatio,
    config.fvgMitigationRule
  );
  debugLogs.push(`[FVG] Detected ${fvgs.length} Fair Value Gaps.`);

  // 5. Liquidity Pools and Sweeps
  const { pools: liquidityPools, sweeps: liquiditySweeps } = detectLiquidity(
    candles,
    swings,
    atrs,
    config.eqhTolerancePercent
  );
  debugLogs.push(`[Liquidity] Found ${liquidityPools.length} liquidity pools, ${liquiditySweeps.length} sweeps.`);

  // 6. Structure Breaks (BOS, CHoCH, MSS)
  const {
    breaks: structureBreaks,
    activeBias,
    protectedHigh,
    protectedLow,
    lastBOS,
    lastCHoCH,
  } = detectStructureBreaks(
    candles,
    swings,
    displacementEvents,
    liquiditySweeps,
    config.bosConfirmation
  );
  debugLogs.push(`[Structure] Generated ${structureBreaks.length} breaks (Active Bias: ${activeBias}).`);

  // 7. Order Blocks
  const orderBlocks = detectOrderBlocks(
    candles,
    structureBreaks,
    fvgs,
    liquiditySweeps,
    displacementEvents,
    config.obMitigationRule
  );
  debugLogs.push(`[OrderBlocks] Detected ${orderBlocks.length} Order Blocks.`);

  // 8. Dealing Range & Fibonacci
  const dealingRange = calculateDealingRange(candles, swings);

  // 9. Previous High / Low
  const prevHighLow = calculatePreviousHighLow(candles);

  // 10. Confluence Signals
  const confluenceSignals = calculateConfluenceSignals(
    candles,
    structureBreaks,
    orderBlocks,
    fvgs,
    liquiditySweeps,
    dealingRange
  );

  return {
    swings,
    internalSwings,
    structureBreaks,
    orderBlocks,
    fvgs,
    liquidityPools,
    liquiditySweeps,
    displacementEvents,
    dealingRange,
    prevHighLow,
    confluenceSignals,
    activeBias,
    protectedHigh,
    protectedLow,
    lastBOS,
    lastCHoCH,
    debugLogs,
  };
}
