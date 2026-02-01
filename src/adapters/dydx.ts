import { ChainInfo, FetchResult, PerpsTag } from '../types';
import { BasePerpsAdapter, truncateDecimals } from './perps-factory';

const INDEXER_BASE = 'https://indexer.dydx.trade/v4';
const PAGE_LIMIT = 100;
const MAX_PAGES = 100;

interface DydxFill {
  id: string;
  side: 'BUY' | 'SELL';
  liquidity: string;
  type: string;
  market: string;
  marketType: string;
  price: string;
  size: string;
  fee: string;
  createdAt: string;
  createdAtHeight: string;
  orderId: string;
  transactionHash: string;
  subaccountNumber: number;
  realizedPnl?: string;
}

interface DydxFillsResponse {
  fills: DydxFill[];
}

interface DydxFundingPayment {
  market: string;
  payment: string;
  rate: string;
  positionSize: string;
  price: string;
  effectiveAt: string;
  effectiveAtHeight: string;
}

interface DydxFundingResponse {
  fundingPayments: DydxFundingPayment[];
}

export class DydxAdapter extends BasePerpsAdapter {
  chainInfo: ChainInfo = {
    id: 'dydx',
    name: 'dYdX v4',
    symbol: 'USDC',
    logo: 'https://dydx.exchange/favicon.ico',
    explorerUrl: 'https://www.mintscan.io/dydx',
    addressRegex: /^dydx1[a-z0-9]{38,}$/,
    addressPlaceholder: 'dydx1...',
    isPerps: true,
  };

  constructor() {
    super({
      id: 'dydx',
      name: 'dYdX v4',
      symbol: 'USDC',
      logo: 'https://dydx.exchange/favicon.ico',
      explorerUrl: 'https://www.mintscan.io/dydx',
      addressRegex: /^dydx1[a-z0-9]{38,}$/,
      addressPlaceholder: 'dydx1...',
      settlementToken: 'USDC',
    });
  }

  private async fetchFills(address: string): Promise<DydxFill[]> {
    const allFills: DydxFill[] = [];
    let createdBeforeOrAt: string | undefined = undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        address,
        subaccountNumber: '0',
        limit: PAGE_LIMIT.toString(),
      });
      if (createdBeforeOrAt) {
        params.set('createdBeforeOrAt', createdBeforeOrAt);
      }

      const url = `${INDEXER_BASE}/fills?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`dYdX Indexer API error (fills): ${response.status} — ${text}`);
      }

      const data: DydxFillsResponse = await response.json();
      const fills = data.fills;

      if (!fills || fills.length === 0) break;

      allFills.push(...fills);

      if (fills.length < PAGE_LIMIT) break;

      const oldest = fills[fills.length - 1];
      const oldestDate = new Date(oldest.createdAt);
      oldestDate.setMilliseconds(oldestDate.getMilliseconds() - 1);
      createdBeforeOrAt = oldestDate.toISOString();
    }

    return allFills;
  }

  private async fetchFundingPayments(address: string): Promise<DydxFundingPayment[]> {
    const allPayments: DydxFundingPayment[] = [];
    let effectiveBeforeOrAt: string | undefined = undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        address,
        subaccountNumber: '0',
        limit: PAGE_LIMIT.toString(),
      });
      if (effectiveBeforeOrAt) {
        params.set('effectiveBeforeOrAt', effectiveBeforeOrAt);
      }

      const url = `${INDEXER_BASE}/historicalFunding/${address}?${params.toString()}`;
      let response = await fetch(url);

      if (!response.ok) {
        const altUrl = `${INDEXER_BASE}/fundingPayments?${params.toString()}`;
        response = await fetch(altUrl);
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`dYdX Indexer API error (funding): ${response.status} — ${text}`);
        }
      }

      const data: DydxFundingResponse = await response.json();
      const payments = data.fundingPayments;

      if (!payments || payments.length === 0) break;

      allPayments.push(...payments);

      if (payments.length < PAGE_LIMIT) break;

      const oldest = payments[payments.length - 1];
      const oldestDate = new Date(oldest.effectiveAt);
      oldestDate.setMilliseconds(oldestDate.getMilliseconds() - 1);
      effectiveBeforeOrAt = oldestDate.toISOString();
    }

    return allPayments;
  }

  async fetchTransactions(address: string): Promise<FetchResult> {
    if (!this.validateAddress(address)) {
      throw new Error("Invalid dYdX v4 address. Must be a bech32 address starting with 'dydx1'.");
    }

    const [fills, funding] = await Promise.all([
      this.fetchFills(address),
      this.fetchFundingPayments(address),
    ]);

    const fillTransactions = fills.map((fill) => {
      if (fill.marketType !== 'PERPETUAL') {
        throw new Error(
          `dYdX fill ${fill.id}: unexpected marketType "${fill.marketType}". ` +
          'This adapter only handles perpetual trades.'
        );
      }

      const size = truncateDecimals(parseFloat(fill.size));
      const fee = truncateDecimals(Math.abs(parseFloat(fill.fee)));

      let pnl: number;
      let isClose: boolean;

      if (fill.realizedPnl !== undefined && fill.realizedPnl !== null) {
        pnl = truncateDecimals(parseFloat(fill.realizedPnl));
        isClose = pnl !== 0;
      } else {
        throw new Error(
          `dYdX fill ${fill.id}: realizedPnl field is missing from API response. ` +
          'Cannot determine if this fill is an open or close without platform-reported realized P&L.'
        );
      }

      const asset = fill.market.split('-')[0];
      const txHash = fill.transactionHash
        ? `${fill.transactionHash}-${fill.id}`
        : `dydx-fill-${fill.id}`;

      const tag: PerpsTag = isClose ? 'close_position' : 'open_position';

      return this.createTransaction({
        hash: txHash,
        timestampMs: new Date(fill.createdAt).getTime(),
        asset,
        amount: size,
        fee,
        pnl: isClose ? pnl : 0,
        tag,
        notes: `${fill.side} ${fill.market} @ ${fill.price} (${fill.type}/${fill.liquidity})`,
        address,
        block: fill.createdAtHeight,
      });
    });

    const fundingTransactions = funding.map((payment) => {
      const amount = truncateDecimals(parseFloat(payment.payment));
      const asset = payment.market.split('-')[0];
      const txHash = `dydx-funding-${payment.market}-${payment.effectiveAtHeight}`;

      return this.createTransaction({
        hash: txHash,
        timestampMs: new Date(payment.effectiveAt).getTime(),
        asset: 'USDC',
        amount: Math.abs(amount),
        fee: 0,
        pnl: amount,
        tag: 'funding_payment',
        notes: `Funding: ${asset} rate=${payment.rate} size=${payment.positionSize}`,
        address,
        block: payment.effectiveAtHeight,
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
    return `https://www.mintscan.io/dydx/tx/${hash}`;
  }
}
