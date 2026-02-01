import { ChainAdapter, ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

export interface SubstrateChainConfig {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  explorerUrl: string;
  subscanBase: string;
  addressPlaceholder: string;
  decimals: number;
}

interface SubscanTransfer {
  hash: string;
  block_num: number;
  block_timestamp: number;
  from: string;
  to: string;
  amount: string;
  fee: string;
  success: boolean;
  asset_symbol?: string;
  module?: string;
  event_idx?: number;
}

interface SubscanResponse {
  code: number;
  message: string;
  data: {
    transfers: SubscanTransfer[];
    count: number;
  };
}

function formatAmount(amount: string, decimals: number): string {
  if (!amount || amount === '0') return '0';
  try {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const intPart = value / divisor;
    const fracPart = value % divisor;
    const fracStr = fracPart.toString().padStart(decimals, '0').slice(0, 8);
    const result = `${intPart}.${fracStr}`.replace(/\.?0+$/, '');
    return result || '0';
  } catch {
    return amount;
  }
}

export function createSubstrateAdapter(config: SubstrateChainConfig): ChainAdapter {
  const chainInfo: ChainInfo = {
    id: config.id,
    name: config.name,
    symbol: config.symbol,
    logo: config.logo,
    explorerUrl: config.explorerUrl,
    addressRegex: /^[1-9A-HJ-NP-Za-km-z]{47,48}$/,
    addressPlaceholder: config.addressPlaceholder,
  };

  return {
    chainInfo,
    validateAddress(address: string): boolean {
      return chainInfo.addressRegex.test(address);
    },
    async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
      const page = options?.cursor ? parseInt(options.cursor) : 0;
      const limit = options?.limit || 100;

      try {
        const response = await fetch(`${config.subscanBase}/api/v2/scan/transfers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address,
            row: limit,
            page,
            direction: options?.direction === 'all' ? undefined : options?.direction,
          }),
        });

        if (!response.ok) {
          throw new Error(`${config.name} Subscan API error: ${response.status}`);
        }

        const data: SubscanResponse = await response.json();
        
        if (data.code !== 0) {
          throw new Error(data.message || `${config.name} Subscan API error`);
        }

        const transfers = data.data?.transfers || [];
        const count = data.data?.count || 0;

        const transactions: NormalizedTransaction[] = transfers.map((tx) => {
          const isIncoming = tx.to?.toLowerCase() === address.toLowerCase();
          
          return {
            chainId: config.id,
            address,
            datetimeUtc: new Date(tx.block_timestamp * 1000).toISOString(),
            hash: tx.hash,
            type: 'transfer',
            direction: isIncoming ? 'in' : 'out',
            counterparty: isIncoming ? tx.from : tx.to,
            asset: tx.asset_symbol || config.symbol,
            amount: formatAmount(tx.amount, config.decimals),
            fee: formatAmount(tx.fee || '0', config.decimals),
            feeAsset: config.symbol,
            status: tx.success ? 'success' : 'failed',
            block: String(tx.block_num),
            explorerUrl: `${config.explorerUrl}/extrinsic/${tx.hash}`,
            notes: '',
            tag: '',
            pnl: '0',
            rawDetails: tx as unknown as Record<string, unknown>,
          };
        });

        const hasMore = (page + 1) * limit < count;

        return {
          transactions,
          nextCursor: hasMore ? String(page + 1) : undefined,
          hasMore,
          totalCount: count,
        };
      } catch (error) {
        console.error(`${config.name} fetch error:`, error);
        throw error;
      }
    },
    getExplorerUrl(hash: string): string {
      return `${config.explorerUrl}/extrinsic/${hash}`;
    },
  };
}

export const substrateChainConfigs: SubstrateChainConfig[] = [
  {
    id: 'polkadot',
    name: 'Polkadot',
    symbol: 'DOT',
    logo: 'https://cryptologos.cc/logos/polkadot-new-dot-logo.png',
    explorerUrl: 'https://polkadot.subscan.io',
    subscanBase: 'https://polkadot.api.subscan.io',
    addressPlaceholder: '16ZL8yLyXv3V3L3z9ofR1ovFLziyXaN1DPq4yffMAZ9czzBD',
    decimals: 10,
  },
  {
    id: 'kusama',
    name: 'Kusama',
    symbol: 'KSM',
    logo: 'https://cryptologos.cc/logos/kusama-ksm-logo.png',
    explorerUrl: 'https://kusama.subscan.io',
    subscanBase: 'https://kusama.api.subscan.io',
    addressPlaceholder: 'HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F',
    decimals: 12,
  },
  {
    id: 'astar',
    name: 'Astar',
    symbol: 'ASTR',
    logo: 'https://assets.coingecko.com/coins/images/22617/large/astr.png',
    explorerUrl: 'https://astar.subscan.io',
    subscanBase: 'https://astar.api.subscan.io',
    addressPlaceholder: 'ZfEuzYHyfo5TZfAFEpXtaVuY2xrmRC4vRqWBnhF1vFsKsTp',
    decimals: 18,
  },
  {
    id: 'acala',
    name: 'Acala',
    symbol: 'ACA',
    logo: 'https://cryptologos.cc/logos/acala-aca-logo.png',
    explorerUrl: 'https://acala.subscan.io',
    subscanBase: 'https://acala.api.subscan.io',
    addressPlaceholder: '23M5ttkmR6KcoUwA7NqBjLuMJFWCvobsD9Zy95MgaAECEhit',
    decimals: 12,
  },
];

export function generateSubstrateAdapters(): Record<string, ChainAdapter> {
  const adapters: Record<string, ChainAdapter> = {};
  for (const config of substrateChainConfigs) {
    adapters[config.id] = createSubstrateAdapter(config);
  }
  return adapters;
}
