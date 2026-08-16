export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed?: boolean;
}

export type SwingType = 'HIGH' | 'LOW';
export type StructureType = 'SWING' | 'INTERNAL';
export type SwingClassification = 'HH' | 'HL' | 'LH' | 'LL' | 'UNCLEAR';

export interface SwingPoint {
  id: string;
  type: SwingType;
  structureType: StructureType;
  price: number;
  time: number; // candle time where swing occurred
  candleIndex: number;
  confirmedTime: number; // candle time when swing was confirmed (pivot lookback reached)
  confirmedIndex: number;
  classification: SwingClassification;
  broken: boolean;
  brokenTime?: number;
  brokenPrice?: number;
  swept: boolean;
  sweptTime?: number;
}

export type StructureBreakType = 'BOS' | 'CHoCH' | 'MSS';
export type Direction = 'BULLISH' | 'BEARISH';

export interface StructureBreak {
  id: string;
  type: StructureBreakType;
  direction: Direction;
  levelPrice: number;
  originSwingId: string;
  originTime: number;
  breakTime: number;
  breakIndex: number;
  confirmationTime: number;
  confirmationType: 'CLOSE' | 'WICK' | 'DISPLACEMENT';
  displacementScore: number;
  rationale: string;
}

export type OrderBlockStatus = 'FRESH' | 'TESTED' | 'MITIGATED' | 'INVALIDATED';
export type DisplacementStrength = 'WEAK' | 'MODERATE' | 'STRONG';

export interface OrderBlock {
  id: string;
  direction: Direction;
  high: number;
  low: number;
  openTime: number;
  closeTime: number;
  candleIndex: number;
  status: OrderBlockStatus;
  mitigationTime?: number;
  mitigationIndex?: number;
  testCount: number;
  volume: number;
  displacement: DisplacementStrength;
  displacementScore: number;
  triggerStructureType?: StructureBreakType;
  hasFVG: boolean;
  hasSweep: boolean;
  confluenceScore: number; // 0-100
  rationale: string;
}

export type FVGStatus = 'FRESH' | 'PARTIALLY_FILLED' | 'MITIGATED' | 'INVALIDATED';

export interface FairValueGap {
  id: string;
  direction: Direction;
  top: number;
  bottom: number;
  mid: number;
  candle1Time: number;
  candle2Time: number;
  candle3Time: number;
  candleIndex: number;
  status: FVGStatus;
  mitigationTime?: number;
  mitigationIndex?: number;
  fillPercentage: number;
  sizeATR: number;
  sizePercent: number;
  confluenceScore: number;
  rationale: string;
}

export type LiquidityType = 'EQH' | 'EQL' | 'BSL' | 'SSL' | 'PDH' | 'PDL' | 'PWH' | 'PWL';

export interface LiquidityPool {
  id: string;
  type: LiquidityType;
  price: number;
  timeRange: [number, number];
  swingIds: string[];
  tolerance: number;
  status: 'ACTIVE' | 'SWEPT';
  sweptTime?: number;
  sweptPrice?: number;
  sweptIndex?: number;
  rationale: string;
}

export interface LiquiditySweep {
  id: string;
  type: 'BSL_SWEEP' | 'SSL_SWEEP';
  targetLevelPrice: number;
  sweepPrice: number;
  sweepTime: number;
  sweepIndex: number;
  confirmationTime: number;
  displacementScore: number;
  rationale: string;
}

export interface DisplacementEvent {
  candleIndex: number;
  time: number;
  direction: Direction;
  score: number;
  bodyToATR: number;
  bodyToRecentAvg: number;
  volumeExpansion: number;
  classification: DisplacementStrength;
}

export interface DealingRange {
  high: number;
  low: number;
  highTime: number;
  lowTime: number;
  equilibrium: number;
  premiumZone: [number, number]; // [eq, high]
  discountZone: [number, number]; // [low, eq]
  oteZone: [number, number]; // Optimal Trade Entry (0.618 - 0.786 retracement)
  currentZone: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM';
}

export interface PreviousHighLow {
  pdh?: number;
  pdl?: number;
  pwh?: number;
  pwl?: number;
  pdhSwept: boolean;
  pdlSwept: boolean;
  pwhSwept: boolean;
  pwlSwept: boolean;
}

export interface ConfluenceSignal {
  id: string;
  time: number;
  candleIndex: number;
  direction: Direction;
  score: number; // 0-100
  classification: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  factors: {
    name: string;
    points: number;
    bullish: boolean;
    description: string;
  }[];
  primaryTrigger: string;
}

export interface MTFBias {
  timeframe: Timeframe;
  structure: 'HH_HL' | 'LH_LL' | 'RANGING' | 'TRANSITIONING';
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  lastBreak?: StructureBreakType;
  confluenceScore: number;
}

export interface SMCConfig {
  // Swings
  showSwingStructure: boolean;
  showInternalStructure: boolean;
  swingPivotLookback: number; // default: 5
  internalPivotLookback: number; // default: 3
  atrPeriod: number; // default: 14
  swingAtrFilter: number; // default: 0.5 (min swing distance in ATR)

  // Structural Breaks
  showBOS: boolean;
  showCHoCH: boolean;
  showMSS: boolean;
  bosConfirmation: 'CLOSE' | 'WICK' | 'DISPLACEMENT';

  // Order Blocks
  showOrderBlocks: boolean;
  obMitigationRule: 'TOUCH' | 'CLOSE_PAST_50' | 'FULL_CLOSE';
  showInvalidatedOBs: boolean;
  maxHistoricalOBs: number;

  // Fair Value Gaps
  showFVG: boolean;
  fvgMinAtrRatio: number; // default: 0.3
  fvgMitigationRule: 'TOUCH' | 'FILL_50' | 'FULL_FILL';
  showFilledFVGs: boolean;
  maxHistoricalFVGs: number;

  // Liquidity
  showLiquidityPools: boolean;
  showLiquiditySweeps: boolean;
  eqhTolerancePercent: number; // default: 0.08%

  // Premium / Discount & Fibonacci
  showDealingRange: boolean;
  showOTE: boolean;

  // Key Levels
  showPDH_PDL: boolean;
  showPWH_PWL: boolean;

  // Displacement & Confluence
  showDisplacement: boolean;
  displacementThreshold: number; // 1.2x ATR
  showConfluenceSignals: boolean;
  minConfluenceScore: number; // default: 60

  // Display options
  showEventBadges: boolean; // on-chart tags and classification labels
  theme: 'dark' | 'midnight' | 'matrix';
  maxZonesToRender: number;
}

export interface SMCState {
  swings: SwingPoint[];
  internalSwings: SwingPoint[];
  structureBreaks: StructureBreak[];
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  liquidityPools: LiquidityPool[];
  liquiditySweeps: LiquiditySweep[];
  displacementEvents: DisplacementEvent[];
  dealingRange?: DealingRange;
  prevHighLow: PreviousHighLow;
  confluenceSignals: ConfluenceSignal[];
  activeBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  protectedHigh?: SwingPoint;
  protectedLow?: SwingPoint;
  lastBOS?: StructureBreak;
  lastCHoCH?: StructureBreak;
  debugLogs: string[];
}

export type SelectedSMCElement =
  | { type: 'ORDER_BLOCK'; data: OrderBlock }
  | { type: 'FVG'; data: FairValueGap }
  | { type: 'BREAK'; data: StructureBreak }
  | { type: 'SWING'; data: SwingPoint }
  | { type: 'LIQUIDITY_POOL'; data: LiquidityPool }
  | { type: 'SWEEP'; data: LiquiditySweep }
  | { type: 'CONFLUENCE'; data: ConfluenceSignal }
  | null;
