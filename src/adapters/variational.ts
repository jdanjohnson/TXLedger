import { BaseChainAdapter } from './base';
import { ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

interface BlockscoutTx {
  hash: string;
  block_number: number;
  timestamp: string;
  from: {
    hash: string;
    name?: string;
  };
  to: {
    hash: string;
    name?: string;
  } | null;
  value: string;
  fee: {
    value: string;
  };
  gas_used: string;
  gas_price: string;
  status: string;
  result: string;
  method: string | null;
  decoded_input?: {
    method_call: string;
    method_id: string;
  };
  raw_input: string;
}

interface BlockscoutResponse {
  items: BlockscoutTx[];
  next_page_params?: {
    block_number: number;
    index: number;
    items_count: number;
  };
}

// Variational Protocol contract addresses on Arbitrum
const VARIATIONAL_CONTRACTS = {
  OLP_VAULT: '0x74bbbb0e7f0bad6938509dd4b556a39a4db1f2cd',
  SETTLEMENT_POOL_FACTORY: '0x0F820B9afC270d658a9fD7D16B1Bdc45b70f074C',
};

// Common method signatures for Variational operations
const METHOD_SIGNATURES: Record<string, string> = {
  '0x': 'transfer',
  '0xa9059cbb': 'token_transfer',
  '0x23b872dd': 'token_transfer_from',
  '0x095ea7b3': 'approve',
  '0xd0e30db0': 'deposit',
  '0x2e1a7d4d': 'withdraw',
  '0x3ccfd60b': 'withdraw_all',
  '0x6a761202': 'execute',
  '0xb6b55f25': 'deposit_amount',
  '0xe8eda9df': 'deposit_collateral',
  '0x69328dec': 'withdraw_collateral',
};

export class VariationalAdapter extends BaseChainAdapter {
  chainInfo: ChainInfo = {
    id: 'variational',
    name: 'Variational (Arbitrum)',
    symbol: 'ETH',
    logo: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    explorerUrl: 'https://arbiscan.io',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    addressPlaceholder: '0x742d35Cc6634C0532925a3b844Bc9e7595f...',
  };

  private apiBase = 'https://arbitrum.blockscout.com/api/v2';

  async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
    try {
      const allTxs = await this.fetchFromBlockscout(address, options?.cursor);
      
      const variationalTxs = allTxs.items.filter(tx => this.isVariationalTx(tx));
      
      const transactions: NormalizedTransaction[] = variationalTxs.map(tx => 
        this.normalizeTx(tx, address)
      );

      const hasMore = !!allTxs.next_page_params;
      let nextCursor: string | undefined;
      if (allTxs.next_page_params) {
        nextCursor = JSON.stringify(allTxs.next_page_params);
      }

      return {
        transactions,
        nextCursor,
        hasMore,
        totalCount: undefined,
      };
    } catch (error) {
      console.error('Variational fetch error:', error);
      throw error;
    }
  }

  private async fetchFromBlockscout(
    address: string,
    cursor?: string
  ): Promise<BlockscoutResponse> {
    let url = `${this.apiBase}/addresses/${address}/transactions`;
    
    if (cursor) {
      try {
        const params = JSON.parse(cursor);
        const searchParams = new URLSearchParams();
        if (params.block_number) searchParams.set('block_number', params.block_number);
        if (params.index) searchParams.set('index', params.index);
        if (params.items_count) searchParams.set('items_count', params.items_count);
        url += `?${searchParams.toString()}`;
      } catch {
        // Invalid cursor, ignore
      }
    }
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Blockscout API error: ${response.status}`);
    }

    const data: BlockscoutResponse = await response.json();
    return data;
  }

  private isVariationalTx(tx: BlockscoutTx): boolean {
    const to = tx.to?.hash?.toLowerCase() || '';
    const from = tx.from?.hash?.toLowerCase() || '';
    
    const variationalAddresses = Object.values(VARIATIONAL_CONTRACTS).map(a => a.toLowerCase());
    
    return variationalAddresses.includes(to) || variationalAddresses.includes(from);
  }

  private normalizeTx(
    tx: BlockscoutTx,
    address: string
  ): NormalizedTransaction {
    const from = tx.from?.hash?.toLowerCase() || '';
    const to = tx.to?.hash?.toLowerCase() || '';
    const isOutgoing = from === address.toLowerCase();
    const isSelf = from === to;

    const methodId = tx.decoded_input?.method_id || tx.raw_input?.slice(0, 10) || '0x';
    const methodName = tx.method || tx.decoded_input?.method_call?.split('(')[0] || '';
    const type = this.determineType(methodId, methodName);

    const fee = this.formatWei(tx.fee?.value || '0');

    let direction: 'in' | 'out' | 'self' | 'unknown' = 'unknown';
    if (isSelf) {
      direction = 'self';
    } else if (type === 'deposit' || type === 'deposit_collateral') {
      direction = 'out';
    } else if (type === 'withdraw' || type === 'withdraw_collateral') {
      direction = 'in';
    } else {
      direction = isOutgoing ? 'out' : 'in';
    }

    let counterparty = isOutgoing ? to : from;
    if (tx.to && this.isVariationalContract(tx.to.hash)) {
      counterparty = this.getContractName(tx.to.hash);
    }

    return {
      chainId: this.chainInfo.id,
      address,
      datetimeUtc: tx.timestamp,
      hash: tx.hash,
      type,
      direction,
      counterparty,
      asset: 'ETH',
      amount: this.formatWei(tx.value),
      fee,
      feeAsset: 'ETH',
      status: tx.status === 'ok' ? 'success' : 'failed',
      block: String(tx.block_number),
      explorerUrl: this.getExplorerUrl(tx.hash),
      notes: methodName,
      tag: this.getTag(type),
      pnl: '',
      rawDetails: tx as unknown as Record<string, unknown>,
    };
  }

  private determineType(methodId: string, functionName?: string): string {
    // Check known method signatures
    const knownType = METHOD_SIGNATURES[methodId.toLowerCase()];
    if (knownType) return knownType;

    // Try to parse from function name
    if (functionName) {
      const fn = functionName.toLowerCase();
      if (fn.includes('deposit')) return 'deposit';
      if (fn.includes('withdraw')) return 'withdraw';
      if (fn.includes('open') && fn.includes('position')) return 'open_position';
      if (fn.includes('close') && fn.includes('position')) return 'close_position';
      if (fn.includes('liquidate')) return 'liquidation';
      if (fn.includes('settle')) return 'settlement';
      if (fn.includes('claim')) return 'claim';
      if (fn.includes('swap')) return 'swap';
    }

    return 'contract';
  }

  private getTag(type: string): string {
    // Map transaction types to Awaken CSV tags
    switch (type) {
      case 'open_position':
      case 'deposit':
      case 'deposit_collateral':
        return 'open_position';
      case 'close_position':
      case 'withdraw':
      case 'withdraw_collateral':
        return 'close_position';
      case 'claim':
      case 'settlement':
        return 'funding_payment';
      default:
        return '';
    }
  }

  private isVariationalContract(address: string): boolean {
    const lower = address.toLowerCase();
    return Object.values(VARIATIONAL_CONTRACTS).some(a => a.toLowerCase() === lower);
  }

  private getContractName(address: string): string {
    const lower = address.toLowerCase();
    if (lower === VARIATIONAL_CONTRACTS.OLP_VAULT.toLowerCase()) {
      return 'Variational OLP Vault';
    }
    if (lower === VARIATIONAL_CONTRACTS.SETTLEMENT_POOL_FACTORY.toLowerCase()) {
      return 'Variational Settlement Pool';
    }
    return 'Variational Protocol';
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
