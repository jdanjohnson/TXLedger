import { BaseChainAdapter } from './base';
import { ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

export class RoninAdapter extends BaseChainAdapter {
  chainInfo: ChainInfo = {
    id: 'ronin',
    name: 'Ronin',
    symbol: 'RON',
    logo: 'https://cryptologos.cc/logos/ronin-ron-logo.png',
    explorerUrl: 'https://app.roninchain.com',
    addressRegex: /^(ronin:|0x)?[a-fA-F0-9]{40}$/,
    addressPlaceholder: 'ronin:1a2b3c4d5e6f7890abcdef1234567890abcdef12',
  };

  private apiBase = 'https://api.roninchain.com';

  private normalizeAddress(address: string): string {
    if (address.startsWith('ronin:')) {
      return '0x' + address.slice(6);
    }
    if (!address.startsWith('0x')) {
      return '0x' + address;
    }
    return address;
  }

  async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
    const normalizedAddress = this.normalizeAddress(address);
    const limit = options?.limit || 100;
    const cursor = options?.cursor ? parseInt(options.cursor) : 0;

    try {
      const url = `${this.apiBase}/ronin/explorer/v2/txs?address=${normalizedAddress}&limit=${limit}&from=${cursor}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Ronin API error: ${response.status}`);
      }

      const data = await response.json();
      const txs = data.result?.items || [];
      const total = data.result?.paging?.total || 0;
      const hasMore = cursor + txs.length < total;

      const transactions: NormalizedTransaction[] = txs.map((tx: Record<string, unknown>) => {
        const from = (tx.from as string || '').toLowerCase();
        const to = (tx.to as string || '').toLowerCase();
        const isIncoming = to === normalizedAddress.toLowerCase();
        const isSelf = from === to;

        const value = tx.value as string || '0';
        const gasUsed = tx.gasUsed as string || tx.gas as string || '0';
        const gasPrice = tx.gasPrice as string || '0';
        const fee = (BigInt(gasUsed) * BigInt(gasPrice)).toString();

        let txType = 'transfer';
        const input = tx.input as string || '';
        if (input && input !== '0x' && input.length > 10) {
          txType = 'contract';
          const methodId = input.slice(0, 10);
          if (methodId === '0xa9059cbb') txType = 'token_transfer';
          else if (methodId === '0x23b872dd') txType = 'token_transfer';
          else if (methodId === '0x095ea7b3') txType = 'approve';
          else if (methodId === '0x38ed1739' || methodId === '0x7ff36ab5') txType = 'swap';
        }

        // API returns blockTime, not timestamp
        const blockTime = tx.blockTime as number || Math.floor(Date.now() / 1000);
        
        return {
          chainId: this.chainInfo.id,
          address,
          datetimeUtc: new Date(blockTime * 1000).toISOString(),
          hash: tx.transactionHash as string || tx.hash as string,
          type: txType,
          direction: isSelf ? 'self' : (isIncoming ? 'in' : 'out'),
          counterparty: isIncoming ? from : to,
          asset: 'RON',
          amount: this.formatWei(value),
          fee: this.formatWei(fee),
          feeAsset: 'RON',
          status: (tx.status as number) === 1 ? 'success' : 'failed',
          block: String(tx.blockNumber),
          explorerUrl: this.getExplorerUrl(tx.hash as string),
          notes: '',
          tag: '',
          pnl: '0',
          rawDetails: tx,
        };
      });

      const nextCursor = hasMore ? String(cursor + txs.length) : undefined;

      return {
        transactions,
        nextCursor,
        hasMore,
      };
    } catch (error) {
      console.error('Ronin fetch error:', error);
      throw error;
    }
  }

  private formatWei(wei: string): string {
    try {
      const value = BigInt(wei);
      const divisor = BigInt(10 ** 18);
      const intPart = value / divisor;
      const fracPart = value % divisor;
      const fracStr = fracPart.toString().padStart(18, '0').slice(0, 8);
      return `${intPart}.${fracStr}`.replace(/\.?0+$/, '') || '0';
    } catch {
      return '0';
    }
  }

  getExplorerUrl(hash: string): string {
    return `${this.chainInfo.explorerUrl}/tx/${hash}`;
  }
}
