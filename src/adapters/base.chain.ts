import { BaseChainAdapter } from './base';
import { ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

interface BlockscoutTx {
  hash: string;
  block_number: number;
  timestamp: string;
  from: {
    hash: string;
  };
  to: {
    hash: string;
  } | null;
  value: string;
  fee: {
    value: string;
  };
  gas_limit: string;
  gas_price: string;
  gas_used: string;
  status: string;
  method: string | null;
  decoded_input: {
    method_call: string;
  } | null;
  transaction_types: string[];
  has_error_in_internal_transactions: boolean | null;
}

interface BlockscoutResponse {
  items: BlockscoutTx[];
  next_page_params: {
    block_number: number;
    index: number;
    items_count: number;
    hash: string;
  } | null;
}

export class BaseChainAdapter2 extends BaseChainAdapter {
  chainInfo: ChainInfo = {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    logo: 'https://cryptologos.cc/logos/base-base-logo.png',
    explorerUrl: 'https://basescan.org',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    addressPlaceholder: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  };

  private apiBase = 'https://base.blockscout.com/api/v2';

  async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
    try {
      let url = `${this.apiBase}/addresses/${address}/transactions`;
      
      if (options?.cursor) {
        url += `?${options.cursor}`;
      }
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Blockscout API error: ${response.status}`);
      }

      const data: BlockscoutResponse = await response.json();
      
      const txs = data.items || [];

      const transactions: NormalizedTransaction[] = txs.map((tx) => {
        const fromAddr = tx.from?.hash?.toLowerCase() || '';
        const toAddr = tx.to?.hash?.toLowerCase() || '';
        const addrLower = address.toLowerCase();
        
        const isIncoming = toAddr === addrLower;
        const isSelf = fromAddr === toAddr;
        
        return {
          chainId: this.chainInfo.id,
          address,
          datetimeUtc: tx.timestamp,
          hash: tx.hash,
          type: this.determineType(tx),
          direction: isSelf ? 'self' : (isIncoming ? 'in' : 'out'),
          counterparty: isIncoming ? fromAddr : toAddr,
          asset: 'ETH',
          amount: this.formatWei(tx.value),
          fee: this.formatWei(tx.fee?.value || '0'),
          feeAsset: 'ETH',
          status: tx.status === 'ok' ? 'success' : 'failed',
          block: String(tx.block_number),
          explorerUrl: this.getExplorerUrl(tx.hash),
          notes: tx.method || '',
          tag: '',
          pnl: '0',
          rawDetails: tx as unknown as Record<string, unknown>,
        };
      });

      let nextCursor: string | undefined;
      if (data.next_page_params) {
        const params = new URLSearchParams();
        params.set('block_number', String(data.next_page_params.block_number));
        params.set('index', String(data.next_page_params.index));
        params.set('items_count', String(data.next_page_params.items_count));
        nextCursor = params.toString();
      }

      return {
        transactions,
        nextCursor,
        hasMore: !!data.next_page_params,
      };
    } catch (error) {
      console.error('Base fetch error:', error);
      throw error;
    }
  }

  private determineType(tx: BlockscoutTx): string {
    const types = tx.transaction_types || [];
    if (types.includes('coin_transfer') && types.length === 1) return 'transfer';
    if (types.includes('token_transfer')) return 'token_transfer';
    if (tx.method?.toLowerCase().includes('swap')) return 'swap';
    if (tx.method?.toLowerCase().includes('stake')) return 'stake';
    if (tx.method?.toLowerCase().includes('claim')) return 'claim';
    if (tx.method?.toLowerCase().includes('approve')) return 'approve';
    if (types.includes('contract_call')) return 'contract';
    return 'transfer';
  }

  private formatWei(wei: string): string {
    if (!wei || wei === '0') return '0';
    try {
      const value = BigInt(wei);
      const decimals = 18;
      const divisor = BigInt(10 ** decimals);
      const intPart = value / divisor;
      const fracPart = value % divisor;
      const fracStr = fracPart.toString().padStart(decimals, '0').slice(0, 8);
      const result = `${intPart}.${fracStr}`.replace(/\.?0+$/, '');
      return result || '0';
    } catch {
      return wei;
    }
  }

  getExplorerUrl(hash: string): string {
    return `${this.chainInfo.explorerUrl}/tx/${hash}`;
  }
}
