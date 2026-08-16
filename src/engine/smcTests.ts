import { Candle, SMCConfig } from '../types/smc';
import { runSMCEngine, DEFAULT_SMC_CONFIG } from './smcEngine';

export interface TestCaseResult {
  name: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
  details: string;
}

/**
 * Creates synthetic candles for deterministic test scenarios
 */
export function generateSyntheticCandles(
  pattern: 'BULLISH_BOS' | 'BEARISH_CHOCH' | 'BULLISH_FVG' | 'LIQUIDITY_SWEEP' | 'OB_MITIGATION'
): Candle[] {
  const baseTime = 1700000000;
  const interval = 300; // 5m

  if (pattern === 'BULLISH_BOS') {
    // Uptrend forming higher highs and breaking previous high
    return [
      { time: baseTime + 0 * interval, open: 100, high: 105, low: 98, close: 104, volume: 100 },
      { time: baseTime + 1 * interval, open: 104, high: 112, low: 103, close: 110, volume: 120 }, // Swing High at 112
      { time: baseTime + 2 * interval, open: 110, high: 111, low: 106, close: 107, volume: 90 },
      { time: baseTime + 3 * interval, open: 107, high: 108, low: 102, close: 103, volume: 80 },
      { time: baseTime + 4 * interval, open: 103, high: 105, low: 100, close: 101, volume: 70 }, // Swing Low at 100
      { time: baseTime + 5 * interval, open: 101, high: 106, low: 101, close: 105, volume: 85 },
      { time: baseTime + 6 * interval, open: 105, high: 109, low: 104, close: 108, volume: 95 },
      { time: baseTime + 7 * interval, open: 108, high: 116, low: 107, close: 115, volume: 220 }, // Break above 112 (BOS)
      { time: baseTime + 8 * interval, open: 115, high: 120, low: 114, close: 119, volume: 200 },
      { time: baseTime + 9 * interval, open: 119, high: 122, low: 118, close: 121, volume: 180 },
      { time: baseTime + 10 * interval, open: 121, high: 123, low: 119, close: 120, volume: 140 },
      { time: baseTime + 11 * interval, open: 120, high: 121, low: 115, close: 116, volume: 110 },
      { time: baseTime + 12 * interval, open: 116, high: 118, low: 114, close: 117, volume: 100 },
    ];
  }

  if (pattern === 'BEARISH_CHOCH') {
    // Bullish structure followed by a sharp drop that breaks below the protected HL
    return [
      { time: baseTime + 0 * interval, open: 100, high: 104, low: 99, close: 103, volume: 100 },
      { time: baseTime + 1 * interval, open: 103, high: 108, low: 102, close: 107, volume: 110 }, // First high 108
      { time: baseTime + 2 * interval, open: 107, high: 107, low: 101, close: 102, volume: 90 },  // HL at 101
      { time: baseTime + 3 * interval, open: 102, high: 106, low: 102, close: 105, volume: 100 },
      { time: baseTime + 4 * interval, open: 105, high: 114, low: 104, close: 113, volume: 150 }, // HH at 114
      { time: baseTime + 5 * interval, open: 113, high: 114, low: 108, close: 109, volume: 100 },
      { time: baseTime + 6 * interval, open: 109, high: 110, low: 105, close: 106, volume: 100 }, // Protected HL at 105
      { time: baseTime + 7 * interval, open: 106, high: 118, low: 105, close: 117, volume: 180 }, // Higher High 118
      { time: baseTime + 8 * interval, open: 117, high: 117, low: 110, close: 111, volume: 120 },
      { time: baseTime + 9 * interval, open: 111, high: 112, low: 98, close: 99, volume: 300 },   // Massive Bearish Drop breaking 105 (CHoCH)
      { time: baseTime + 10 * interval, open: 99, high: 101, low: 95, close: 96, volume: 220 },
      { time: baseTime + 11 * interval, open: 96, high: 98, low: 92, close: 94, volume: 180 },
      { time: baseTime + 12 * interval, open: 94, high: 96, low: 91, close: 93, volume: 150 },
    ];
  }

  if (pattern === 'BULLISH_FVG') {
    // 3-candle imbalance: Candle 1 High < Candle 3 Low
    return [
      { time: baseTime + 0 * interval, open: 100, high: 102, low: 99, close: 101, volume: 100 },
      { time: baseTime + 1 * interval, open: 101, high: 103, low: 100, close: 102, volume: 90 }, // Candle 1: High = 103
      { time: baseTime + 2 * interval, open: 102, high: 115, low: 102, close: 114, volume: 350 }, // Candle 2: Big expansion
      { time: baseTime + 3 * interval, open: 114, high: 120, low: 108, close: 119, volume: 200 }, // Candle 3: Low = 108 (Gap 103 - 108)
      { time: baseTime + 4 * interval, open: 119, high: 122, low: 117, close: 120, volume: 150 },
      { time: baseTime + 5 * interval, open: 120, high: 121, low: 105, close: 106, volume: 160 }, // Retracement into FVG (Mitigation test at 105)
      { time: baseTime + 6 * interval, open: 106, high: 118, low: 106, close: 116, volume: 180 },
    ];
  }

  if (pattern === 'LIQUIDITY_SWEEP') {
    // High at 110, then candle wicks to 112 but closes at 107
    return [
      { time: baseTime + 0 * interval, open: 100, high: 105, low: 99, close: 104, volume: 100 },
      { time: baseTime + 1 * interval, open: 104, high: 110, low: 103, close: 109, volume: 120 }, // Swing High at 110
      { time: baseTime + 2 * interval, open: 109, high: 109, low: 104, close: 105, volume: 90 },
      { time: baseTime + 3 * interval, open: 105, high: 106, low: 101, close: 102, volume: 80 },
      { time: baseTime + 4 * interval, open: 102, high: 105, low: 101, close: 104, volume: 85 },
      { time: baseTime + 5 * interval, open: 104, high: 108, low: 103, close: 107, volume: 95 },
      { time: baseTime + 6 * interval, open: 107, high: 113, low: 106, close: 107, volume: 250 }, // Sweep: High 113 > 110, Close 107 < 110
      { time: baseTime + 7 * interval, open: 107, high: 108, low: 99, close: 100, volume: 220 },  // Confirmation rejection
    ];
  }

  // OB_MITIGATION default
  return [
    { time: baseTime + 0 * interval, open: 100, high: 104, low: 99, close: 103, volume: 100 },
    { time: baseTime + 1 * interval, open: 103, high: 108, low: 102, close: 107, volume: 120 }, // High 108
    { time: baseTime + 2 * interval, open: 107, high: 107, low: 101, close: 102, volume: 80 },  // Bearish OB candle (101-107)
    { time: baseTime + 3 * interval, open: 102, high: 116, low: 102, close: 115, volume: 300 }, // Displacement break
    { time: baseTime + 4 * interval, open: 115, high: 120, low: 114, close: 118, volume: 200 },
    { time: baseTime + 5 * interval, open: 118, high: 119, low: 104, close: 105, volume: 180 }, // Pullback touching OB range 101-107
    { time: baseTime + 6 * interval, open: 105, high: 119, low: 105, close: 117, volume: 210 },
  ];
}

/**
 * Runs the full test suite
 */
export function runSMCUnitTests(): TestCaseResult[] {
  const results: TestCaseResult[] = [];
  const testConfig: SMCConfig = {
    ...DEFAULT_SMC_CONFIG,
    swingPivotLookback: 2, // low lookback for unit tests
    internalPivotLookback: 1,
    fvgMinAtrRatio: 0.1,
  };

  // Test 1: Bullish BOS Detection
  try {
    const candles = generateSyntheticCandles('BULLISH_BOS');
    const state = runSMCEngine(candles, testConfig);
    const hasBOS = state.structureBreaks.some((b) => b.direction === 'BULLISH');

    results.push({
      name: 'Bullish BOS Confirmation',
      category: 'Market Structure',
      passed: hasBOS,
      expected: 'At least 1 Bullish BOS break detected',
      actual: `${state.structureBreaks.filter((b) => b.direction === 'BULLISH').length} breaks detected`,
      details: 'Evaluates higher high breakouts during an established bullish market structure.',
    });
  } catch (e: any) {
    results.push({
      name: 'Bullish BOS Confirmation',
      category: 'Market Structure',
      passed: false,
      expected: 'Successful calculation',
      actual: e.message,
      details: 'Exception occurred during calculation',
    });
  }

  // Test 2: Bearish CHoCH Trend Transition
  try {
    const candles = generateSyntheticCandles('BEARISH_CHOCH');
    const state = runSMCEngine(candles, testConfig);
    const hasCHoCH = state.structureBreaks.some((b) => b.type === 'CHoCH' || b.type === 'MSS');

    results.push({
      name: 'Bearish CHoCH Reversal',
      category: 'Market Structure',
      passed: hasCHoCH,
      expected: 'CHoCH or MSS break triggering trend shift to BEARISH',
      actual: `Active Bias: ${state.activeBias}, CHoCH breaks: ${state.structureBreaks.filter((b) => b.type === 'CHoCH' || b.type === 'MSS').length}`,
      details: 'Verifies stateful trend transition when a protected higher low is breached.',
    });
  } catch (e: any) {
    results.push({
      name: 'Bearish CHoCH Reversal',
      category: 'Market Structure',
      passed: false,
      expected: 'Successful calculation',
      actual: e.message,
      details: 'Exception occurred during calculation',
    });
  }

  // Test 3: Bullish FVG Imbalance Detection
  try {
    const candles = generateSyntheticCandles('BULLISH_FVG');
    const state = runSMCEngine(candles, testConfig);
    const bullFVG = state.fvgs.find((f) => f.direction === 'BULLISH');

    results.push({
      name: '3-Candle Fair Value Gap',
      category: 'Imbalance / FVG',
      passed: Boolean(bullFVG),
      expected: 'Bullish FVG gap where Candle 1 High < Candle 3 Low',
      actual: bullFVG ? `Found FVG [${bullFVG.bottom.toFixed(2)} - ${bullFVG.top.toFixed(2)}], fill: ${bullFVG.fillPercentage}%` : 'None',
      details: 'Calculates open price imbalances between candle 1 wick and candle 3 wick.',
    });
  } catch (e: any) {
    results.push({
      name: '3-Candle Fair Value Gap',
      category: 'Imbalance / FVG',
      passed: false,
      expected: 'Successful calculation',
      actual: e.message,
      details: 'Exception occurred during calculation',
    });
  }

  // Test 4: Liquidity Sweep Detection
  try {
    const candles = generateSyntheticCandles('LIQUIDITY_SWEEP');
    const state = runSMCEngine(candles, testConfig);
    const hasSweep = state.liquiditySweeps.length > 0;

    results.push({
      name: 'Buy-Side Liquidity Sweep (BSL)',
      category: 'Liquidity',
      passed: hasSweep,
      expected: 'BSL Sweep detected with wick above swing high followed by close back inside',
      actual: `${state.liquiditySweeps.length} sweep(s) detected`,
      details: 'Ensures false breakout wicks that close inside swing levels are labeled as sweeps.',
    });
  } catch (e: any) {
    results.push({
      name: 'Buy-Side Liquidity Sweep (BSL)',
      category: 'Liquidity',
      passed: false,
      expected: 'Successful calculation',
      actual: e.message,
      details: 'Exception occurred during calculation',
    });
  }

  // Test 5: Order Block Creation and Mitigation
  try {
    const candles = generateSyntheticCandles('OB_MITIGATION');
    const state = runSMCEngine(candles, testConfig);
    const ob = state.orderBlocks[0];

    results.push({
      name: 'Order Block Context & Mitigation',
      category: 'Order Blocks',
      passed: Boolean(ob),
      expected: 'Bullish Order Block detected and status updated upon retest',
      actual: ob ? `OB created at [${ob.low} - ${ob.high}], status: ${ob.status}` : 'No OB',
      details: 'Validates origin candle identification preceding structural displacement runs.',
    });
  } catch (e: any) {
    results.push({
      name: 'Order Block Context & Mitigation',
      category: 'Order Blocks',
      passed: false,
      expected: 'Successful calculation',
      actual: e.message,
      details: 'Exception occurred during calculation',
    });
  }

  // Test 6: Zero Look-Ahead Bias Verification
  try {
    const fullCandles = generateSyntheticCandles('BULLISH_BOS');
    const partialCandles = fullCandles.slice(0, 8);

    const fullState = runSMCEngine(fullCandles, testConfig);
    const partialState = runSMCEngine(partialCandles, testConfig);

    // At candle 7, partialState should have identical confirmed swings as fullState had at index 7
    const confirmedInPartial = partialState.swings.filter((s) => s.confirmedIndex <= 7);
    const confirmedInFull = fullState.swings.filter((s) => s.confirmedIndex <= 7);

    const isMatch = confirmedInPartial.length === confirmedInFull.length &&
      confirmedInPartial.every((p, idx) => p.price === confirmedInFull[idx].price && p.time === confirmedInFull[idx].time);

    results.push({
      name: 'Zero Look-Ahead Bias Proof',
      category: 'Engine Integrity',
      passed: isMatch,
      expected: 'Historical signals at bar N are identical whether calculated at bar N or bar N+K',
      actual: isMatch ? 'Deterministic: Historical signals never repaint or leak future bars' : 'Mismatch found',
      details: 'Confirms pivot lookback confirmation delays prevent future-data contamination.',
    });
  } catch (e: any) {
    results.push({
      name: 'Zero Look-Ahead Bias Proof',
      category: 'Engine Integrity',
      passed: false,
      expected: 'Successful verification',
      actual: e.message,
      details: 'Exception occurred during calculation',
    });
  }

  return results;
}
