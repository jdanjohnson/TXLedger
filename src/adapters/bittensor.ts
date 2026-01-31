import { ChainAdapter, ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

export class BittensorAdapter implements ChainAdapter {
  chainInfo: ChainInfo = {
    id: 'bittensor',
    name: 'Bittensor',
    symbol: 'TAO',
    logo: 'https://raw.githubusercontent.com/nickspaargaren/no-google/master/images/bittensor.png',
    explorerUrl: 'https://taostats.io',
    addressRegex: /^5[a-zA-Z0-9]{47}$/,
    addressPlaceholder: '5FFApaS75bv5pJHfAp2FVLBj9ZaXuFDjEypsaBNc1wCfe52v',
  };

  private apiBase = 'https://api.taostats.io';
  private apiKey = 'tao-9135ffc8-5447-48a4-8c72-4cec4ad4fda9:a4d4fba7';

  validateAddress(address: string): boolean {
    return this.chainInfo.addressRegex.test(address);
  }

  async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
    const limit = options?.limit || 100;
    const page = options?.cursor ? parseInt(options.cursor) : 1;

    try {
      const url = `${this.apiBase}/api/transfer/v1?coldkey=${address}&limit=${limit}&page=${page}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Bittensor API error: ${response.status}`);
      }

      const data = await response.json();
      const transfers = data.data || [];
      const pagination = data.pagination || {};
      const hasMore = pagination.next_page !== null;

      const transactions: NormalizedTransaction[] = transfers.map((tx: Record<string, unknown>) => {
        const from = (tx.from as { ss58: string })?.ss58 || '';
        const to = (tx.to as { ss58: string })?.ss58 || '';
        const isOutgoing = from.toLowerCase() === address.toLowerCase();
        const amount = this.formatTao(tx.amount as string);
        const fee = this.formatTao(tx.fee as string);

        return {
          chainId: 'bittensor',
          address,
          datetimeUtc: tx.timestamp as string,
          hash: tx.transaction_hash as string || tx.extrinsic_id as string,
          type: 'transfer',
          direction: isOutgoing ? 'out' : 'in',
          counterparty: isOutgoing ? to : from,
          asset: 'TAO',
          amount,
          fee,
          feeAsset: 'TAO',
          status: 'success',
          block: String(tx.block_number || ''),
          explorerUrl: this.getExplorerUrl(tx.extrinsic_id as string),
          notes: '',
          tag: '',
          pnl: '',
          rawDetails: tx,
        };
      });

      return {
        transactions,
        nextCursor: hasMore ? String(page + 1) : undefined,
        hasMore,
        totalCount: pagination.total_items,
      };
    } catch (error) {
      console.error('Bittensor fetch error:', error);
      throw error;
    }
  }

  private formatTao(rawAmount: string | number): string {
    if (!rawAmount) return '0';
    const amount = BigInt(rawAmount);
    const decimals = BigInt(10 ** 9);
    const whole = amount / decimals;
    const fraction = amount % decimals;
    if (fraction === BigInt(0)) {
      return whole.toString();
    }
    const fractionStr = fraction.toString().padStart(9, '0').replace(/0+$/, '');
    return `${whole}.${fractionStr}`;
  }

  getExplorerUrl(extrinsicId: string): string {
    return `https://taostats.io/extrinsic/${extrinsicId}`;
  }
}
