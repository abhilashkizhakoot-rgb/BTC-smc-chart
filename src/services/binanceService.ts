import { Candle, Timeframe } from '../types/smc';

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
}

const BINANCE_REST_ENDPOINTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
];

const BINANCE_WS_ENDPOINTS = [
  'wss://stream.binance.com:9443/ws',
  'wss://stream.binance.com:443/ws',
  'wss://data-stream.binance.vision/ws',
];

/**
 * Generates realistic initial fallback crypto candles if Binance REST fails
 */
export function generateRealisticFallbackCandles(
  symbol: string = 'BTCUSDT',
  interval: Timeframe = '5m',
  count: number = 300
): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  const intervalSeconds =
    interval === '1m' ? 60 :
    interval === '3m' ? 180 :
    interval === '5m' ? 300 :
    interval === '15m' ? 900 :
    interval === '30m' ? 1800 :
    interval === '1h' ? 3600 :
    interval === '4h' ? 14400 : 86400;

  let basePrice = symbol.includes('BTC') ? 96500 : symbol.includes('ETH') ? 2750 : symbol.includes('SOL') ? 185 : 550;
  let time = now - count * intervalSeconds;

  for (let i = 0; i < count; i++) {
    // Generate trending waves with pullbacks
    const cycle = Math.sin(i / 15) * 400 + Math.sin(i / 5) * 150;
    const noise = (Math.random() - 0.48) * (basePrice * 0.004);
    const open = basePrice;
    const change = (cycle * 0.05) + noise;
    const close = Math.max(10, open + change);
    const spread = Math.abs(open - close);
    const high = Math.max(open, close) + Math.random() * (spread * 0.8 + basePrice * 0.001);
    const low = Math.min(open, close) - Math.random() * (spread * 0.8 + basePrice * 0.001);
    const volume = Math.floor(50 + Math.random() * 300 + (Math.abs(change) / basePrice) * 50000);

    candles.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
      isClosed: true,
    });

    basePrice = close;
    time += intervalSeconds;
  }

  return candles;
}

/**
 * Fetch Historical Candles from Binance REST API
 */
export async function fetchHistoricalCandles(
  symbol: string = 'BTCUSDT',
  interval: Timeframe = '5m',
  limit: number = 500,
  endTime?: number
): Promise<Candle[]> {
  for (const endpoint of BINANCE_REST_ENDPOINTS) {
    try {
      const url = new URL(`${endpoint}/api/v3/klines`);
      url.searchParams.set('symbol', symbol.toUpperCase());
      url.searchParams.set('interval', interval);
      url.searchParams.set('limit', limit.toString());
      if (endTime) {
        url.searchParams.set('endTime', (endTime * 1000).toString());
      }

      const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) continue;

      const raw = await res.json();
      if (!Array.isArray(raw) || raw.length === 0) continue;

      const candles: Candle[] = raw.map((item: any) => ({
        time: Math.floor(item[0] / 1000),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
        isClosed: true,
      }));

      return candles;
    } catch (err) {
      console.warn(`[Binance REST] Endpoint ${endpoint} failed:`, err);
    }
  }

  console.warn('[Binance REST] All endpoints failed, using generated dataset.');
  return generateRealisticFallbackCandles(symbol, interval, limit);
}

/**
 * Fetch 24h Ticker statistics
 */
export async function fetch24hTicker(symbol: string = 'BTCUSDT'): Promise<Ticker24h | null> {
  for (const endpoint of BINANCE_REST_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);
      if (!res.ok) continue;
      const data = await res.json();
      return {
        symbol: data.symbol,
        lastPrice: parseFloat(data.lastPrice),
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        highPrice: parseFloat(data.highPrice),
        lowPrice: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        quoteVolume: parseFloat(data.quoteVolume),
      };
    } catch (e) {
      // Continue to next endpoint
    }
  }
  return null;
}

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'OFFLINE';

export class BinanceWebSocketClient {
  private ws: WebSocket | null = null;
  private symbol: string;
  private interval: Timeframe;
  private onCandleUpdate: (candle: Candle, isFinal: boolean) => void;
  private onStatusChange: (status: ConnectionStatus) => void;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private isDestroyed = false;
  private endpointIndex = 0;

  constructor(
    symbol: string,
    interval: Timeframe,
    onCandleUpdate: (candle: Candle, isFinal: boolean) => void,
    onStatusChange: (status: ConnectionStatus) => void
  ) {
    this.symbol = symbol.toLowerCase();
    this.interval = interval;
    this.onCandleUpdate = onCandleUpdate;
    this.onStatusChange = onStatusChange;
    this.connect();
  }

  public updateSubscription(symbol: string, interval: Timeframe) {
    if (this.symbol === symbol.toLowerCase() && this.interval === interval) return;
    this.symbol = symbol.toLowerCase();
    this.interval = interval;
    this.reconnect();
  }

  private connect() {
    if (this.isDestroyed) return;
    this.onStatusChange('CONNECTING');

    try {
      const baseWs = BINANCE_WS_ENDPOINTS[this.endpointIndex % BINANCE_WS_ENDPOINTS.length];
      const streamName = `${this.symbol}@kline_${this.interval}`;
      const url = `${baseWs}/${streamName}`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.onStatusChange('CONNECTED');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.e === 'kline') {
            const k = message.k;
            const candle: Candle = {
              time: Math.floor(k.t / 1000),
              open: parseFloat(k.o),
              high: parseFloat(k.h),
              low: parseFloat(k.l),
              close: parseFloat(k.c),
              volume: parseFloat(k.v),
              isClosed: Boolean(k.x),
            };
            this.onCandleUpdate(candle, Boolean(k.x));
          }
        } catch (e) {
          console.error('[Binance WS] Parse error:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[Binance WS] Connection error:', err);
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (!this.isDestroyed) {
          this.onStatusChange('RECONNECTING');
          this.endpointIndex++;
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.warn('[Binance WS] Failed to initiate websocket:', err);
      this.onStatusChange('OFFLINE');
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.isDestroyed) {
        this.connect();
      }
    }, 3000);
  }

  public reconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connect();
  }

  public destroy() {
    this.isDestroyed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStatusChange('OFFLINE');
  }
}
