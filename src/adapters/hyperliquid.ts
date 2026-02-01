import { ChainInfo, FetchResult, PerpsTag } from '../types';
import { BasePerpsAdapter, truncateDecimals } from './perps-factory';

const API_BASE = 'https://api.hyperliquid.xyz/info';

interface HyperliquidFill {
  coin: string;
  px: string;
  sz: string;
  side: 'B' | 'A';
  time: number;
  dir: string;
  closedPnl: string;
  fee: string;
  feeToken: string;
  tid: number;
  oid: number;
  hash: string;
}

interface HyperliquidFundingEntry {
  time: number;
  hash: string;
  delta: {
    coin: string;
    fundingRate: string;
    szi: string;
    type: 'funding';
    usdc: string;
  };
}

function isClose(dir: string): boolean {
  return dir.startsWith('Close');
}

export class HyperliquidAdapter extends BasePerpsAdapter {
  chainInfo: ChainInfo = {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    symbol: 'USDC',
    logo: 'https://hyperliquid.xyz/favicon.ico',
    explorerUrl: 'https://app.hyperliquid.xyz',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    addressPlaceholder: '0x...',
    isPerps: true,
  };

  constructor() {
    super({
      id: 'hyperliquid',
      name: 'Hyperliquid',
      symbol: 'USDC',
      logo: 'https://hyperliquid.xyz/favicon.ico',
      explorerUrl: 'https://app.hyperliquid.xyz',
      addressRegex: /^0x[a-fA-F0-9]{40}$/,
      addressPlaceholder: '0x...',
      settlementToken: 'USDC',
    });
  }

  private async fetchAllFills(account: string): Promise<HyperliquidFill[]> {
    const allFills: HyperliquidFill[] = [];
    let endTime = Date.now();
    const MAX_PAGES = 50;

    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'userFillsByTime',
          user: account,
          startTime: 0,
          endTime,
          aggregateByTime: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Hyperliquid API error (fills): ${response.status} ${response.statusText}`);
      }

      const fills: HyperliquidFill[] = await response.json();

      if (fills.length === 0) break;

      allFills.push(...fills);

      if (fills.length < 2000) break;

      const oldestTime = Math.min(...fills.map((f) => f.time));
      endTime = oldestTime - 1;
    }

    return allFills;
  }

  private async fetchAllFunding(account: string): Promise<HyperliquidFundingEntry[]> {
    const allFunding: HyperliquidFundingEntry[] = [];
    let endTime = Date.now();
    const MAX_PAGES = 50;

    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'userFunding',
          user: account,
          startTime: 0,
          endTime,
        }),
      });

      if (!response.ok) {
        throw new Error(`Hyperliquid API error (funding): ${response.status} ${response.statusText}`);
      }

      const entries: HyperliquidFundingEntry[] = await response.json();

      if (entries.length === 0) break;

      allFunding.push(...entries);

      if (entries.length < 2000) break;

      const oldestTime = Math.min(...entries.map((e) => e.time));
      endTime = oldestTime - 1;
    }

    return allFunding;
  }

  async fetchTransactions(address: string): Promise<FetchResult> {
    if (!this.validateAddress(address)) {
      throw new Error('Invalid Ethereum address. Must be a 42-character hex address starting with 0x.');
    }

    const [fills, funding] = await Promise.all([
      this.fetchAllFills(address),
      this.fetchAllFunding(address),
    ]);

    const fillTransactions = fills.map((fill) => {
      const close = isClose(fill.dir);
      const size = truncateDecimals(Math.abs(parseFloat(fill.sz)));
      const fee = truncateDecimals(Math.abs(parseFloat(fill.fee)));
      const closedPnl = truncateDecimals(parseFloat(fill.closedPnl));
      const tag: PerpsTag = close ? 'close_position' : 'open_position';

      return this.createTransaction({
        hash: fill.hash ? `${fill.hash}-${fill.tid}` : `fill-${fill.tid}`,
        timestampMs: fill.time,
        asset: fill.coin,
        amount: size,
        fee,
        pnl: close ? closedPnl : 0,
        tag,
        notes: `${fill.dir} @ ${fill.px}`,
        address,
      });
    });

    const fundingTransactions = funding.map((entry) => {
      const usdcAmount = truncateDecimals(parseFloat(entry.delta.usdc));

      return this.createTransaction({
        hash: entry.hash ? `${entry.hash}-funding-${entry.time}` : `funding-${entry.delta.coin}-${entry.time}`,
        timestampMs: entry.time,
        asset: 'USDC',
        amount: Math.abs(usdcAmount),
        fee: 0,
        pnl: usdcAmount,
        tag: 'funding_payment',
        notes: `Funding: ${entry.delta.coin} rate=${entry.delta.fundingRate} size=${entry.delta.szi}`,
        address,
      });
    });

    const allTransactions = [...fillTransactions, ...fundingTransactions].sort((a, b) => {
      return new Date(b.datetimeUtc).getTime() - new Date(a.datetimeUtc).getTime();
    });

    return {
      transactions: allTransactions,
      hasMore: false,
      totalCount: allTransactions.length,
    };
  }

  getExplorerUrl(hash: string): string {
    return `https://app.hyperliquid.xyz/explorer/tx/${hash}`;
  }
}
