import { ChainInfo, FetchResult, PerpsTag } from '../types';
import { BasePerpsAdapter, truncateDecimals } from './perps-factory';

const GMX_SUBSQUID_URL = 'https://gmx.squids.live/gmx-synthetics-arbitrum/graphql';

interface GmxTradeAction {
  id: string;
  eventName: string;
  account: string;
  marketAddress: string;
  collateralTokenAddress: string;
  sizeDeltaUsd: string;
  collateralDeltaAmount: string;
  basePnlUsd: string;
  priceImpactUsd: string;
  transaction: {
    hash: string;
    timestamp: number;
    blockNumber: number;
  };
}

interface GmxGraphQLResponse {
  data: {
    tradeActions: GmxTradeAction[];
  };
}

const MARKET_SYMBOLS: Record<string, string> = {
  '0x70d95587d40a2caf56bd97485ab3eec10bee6336': 'ETH',
  '0x47c031236e19d024b42f8ae6780e44a573170703': 'BTC',
  '0x09400d9db990d5ed3f35d7be61dfaeb900af03c9': 'SOL',
  '0xc25cef6061cf5de5eb761b50e4743c1f5d7e5407': 'ARB',
  '0x7f1fa204bb700853d36994da19f830b6ad18455c': 'DOGE',
  '0x0ccb4faa6f1f1b30911619f1184082ab4e25813c': 'LTC',
  '0x2b3a1c2b2a3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e': 'LINK',
};

function getMarketSymbol(marketAddress: string): string {
  const lower = marketAddress.toLowerCase();
  return MARKET_SYMBOLS[lower] || marketAddress.slice(0, 10);
}

export class GmxAdapter extends BasePerpsAdapter {
  chainInfo: ChainInfo = {
    id: 'gmx',
    name: 'GMX (Arbitrum)',
    symbol: 'USDC',
    logo: 'https://gmx.io/favicon.ico',
    explorerUrl: 'https://arbiscan.io',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    addressPlaceholder: '0x...',
    isPerps: true,
  };

  constructor() {
    super({
      id: 'gmx',
      name: 'GMX (Arbitrum)',
      symbol: 'USDC',
      logo: 'https://gmx.io/favicon.ico',
      explorerUrl: 'https://arbiscan.io',
      addressRegex: /^0x[a-fA-F0-9]{40}$/,
      addressPlaceholder: '0x...',
      settlementToken: 'USD',
    });
  }

  private async fetchTradeActions(account: string): Promise<GmxTradeAction[]> {
    const allActions: GmxTradeAction[] = [];
    let skip = 0;
    const limit = 1000;
    const MAX_PAGES = 50;

    for (let page = 0; page < MAX_PAGES; page++) {
      const query = `
        query GetTradeActions($account: String!, $skip: Int!, $limit: Int!) {
          tradeActions(
            where: { account_eq: $account }
            orderBy: transaction_timestamp_DESC
            limit: $limit
            offset: $skip
          ) {
            id
            eventName
            account
            marketAddress
            collateralTokenAddress
            sizeDeltaUsd
            collateralDeltaAmount
            basePnlUsd
            priceImpactUsd
            transaction {
              hash
              timestamp
              blockNumber
            }
          }
        }
      `;

      const response = await fetch(GMX_SUBSQUID_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { account: account.toLowerCase(), skip, limit },
        }),
      });

      if (!response.ok) {
        throw new Error(`GMX Subsquid API error: ${response.status} ${response.statusText}`);
      }

      const result: GmxGraphQLResponse = await response.json();
      const actions = result.data?.tradeActions || [];

      if (actions.length === 0) break;

      allActions.push(...actions);

      if (actions.length < limit) break;

      skip += limit;
    }

    return allActions;
  }

  async fetchTransactions(address: string): Promise<FetchResult> {
    if (!this.validateAddress(address)) {
      throw new Error('Invalid Ethereum address. Must be a 42-character hex address starting with 0x.');
    }

    const actions = await this.fetchTradeActions(address);

    const transactions = actions.map((action) => {
      const sizeDeltaUsd = truncateDecimals(Math.abs(parseFloat(action.sizeDeltaUsd || '0') / 1e30));
      const basePnlUsd = truncateDecimals(parseFloat(action.basePnlUsd || '0') / 1e30);
      const priceImpactUsd = truncateDecimals(parseFloat(action.priceImpactUsd || '0') / 1e30);
      
      const totalPnl = truncateDecimals(basePnlUsd + priceImpactUsd);
      
      const isIncrease = action.eventName.includes('Increase');
      const isDecrease = action.eventName.includes('Decrease');
      
      let tag: PerpsTag;
      if (isIncrease) {
        tag = 'open_position';
      } else if (isDecrease) {
        tag = 'close_position';
      } else {
        tag = totalPnl !== 0 ? 'close_position' : 'open_position';
      }

      const marketSymbol = getMarketSymbol(action.marketAddress);

      return this.createTransaction({
        hash: `${action.transaction.hash}-${action.id}`,
        timestampMs: action.transaction.timestamp * 1000,
        asset: marketSymbol,
        amount: sizeDeltaUsd,
        fee: 0,
        pnl: tag === 'close_position' ? totalPnl : 0,
        tag,
        notes: `${action.eventName} ${marketSymbol}`,
        address,
        block: action.transaction.blockNumber.toString(),
      });
    });

    const sortedTransactions = transactions.sort((a, b) => {
      return new Date(b.datetimeUtc).getTime() - new Date(a.datetimeUtc).getTime();
    });

    return {
      transactions: sortedTransactions,
      hasMore: false,
      totalCount: sortedTransactions.length,
    };
  }

  getExplorerUrl(hash: string): string {
    const txHash = hash.split('-')[0];
    return `https://arbiscan.io/tx/${txHash}`;
  }
}
