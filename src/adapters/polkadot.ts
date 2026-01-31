import { BaseChainAdapter } from './base';
import { ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

export class PolkadotAdapter extends BaseChainAdapter {
  chainInfo: ChainInfo = {
    id: 'polkadot',
    name: 'Polkadot',
    symbol: 'DOT',
    logo: 'https://cryptologos.cc/logos/polkadot-new-dot-logo.png',
    explorerUrl: 'https://polkadot.subscan.io',
    addressRegex: /^[1-9A-HJ-NP-Za-km-z]{47,48}$/,
    addressPlaceholder: '1REAJ1k691g5Eqqg9gL7vvZCBG7FCCZ8zgQkZWd4va5ESih',
  };

  private apiBase = 'https://polkadot.api.subscan.io';

  async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
    const page = options?.cursor ? parseInt(options.cursor) : 0;
    const limit = options?.limit || 100;

    try {
      const response = await fetch(`${this.apiBase}/api/v2/scan/transfers`, {
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
        throw new Error(`Subscan API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.code !== 0) {
        throw new Error(data.message || 'Subscan API error');
      }

      const transfers = data.data?.transfers || [];
      const count = data.data?.count || 0;

      const transactions: NormalizedTransaction[] = transfers.map((tx: Record<string, unknown>) => {
        const isIncoming = (tx.to as string)?.toLowerCase() === address.toLowerCase();
        
        return {
          chainId: this.chainInfo.id,
          address,
          datetimeUtc: new Date((tx.block_timestamp as number) * 1000).toISOString(),
          hash: tx.hash as string,
          type: 'transfer',
          direction: isIncoming ? 'in' : 'out',
          counterparty: isIncoming ? (tx.from as string) : (tx.to as string),
          asset: (tx.asset_symbol as string) || 'DOT',
          amount: this.formatAmount(tx.amount as string),
          fee: this.formatAmount(tx.fee as string || '0'),
          feeAsset: 'DOT',
          status: (tx.success as boolean) ? 'success' : 'failed',
          block: String(tx.block_num),
          explorerUrl: this.getExplorerUrl(tx.hash as string),
          notes: '',
          tag: '',
          pnl: '0',
          rawDetails: tx,
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
      console.error('Polkadot fetch error:', error);
      throw error;
    }
  }

  getExplorerUrl(hash: string): string {
    return `${this.chainInfo.explorerUrl}/extrinsic/${hash}`;
  }

  private formatAmount(amount: string): string {
    if (!amount || amount === '0') return '0';
    try {
      const value = BigInt(amount);
      const decimals = 10;
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
}
