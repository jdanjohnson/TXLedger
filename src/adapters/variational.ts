import { BaseChainAdapter } from './base';
import { ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

interface ArbiscanTxResponse {
  status: string;
  message: string;
  result: Array<{
    blockNumber: string;
    timeStamp: string;
    hash: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    gasUsed: string;
    isError: string;
    input: string;
    methodId: string;
    functionName: string;
  }>;
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

  // Arbiscan API (free tier: 5 calls/sec)
  private apiBase = 'https://api.arbiscan.io/api';
  
  // Note: For production, you should use an environment variable for the API key
  // Free tier works without API key but has lower rate limits
  private apiKey = '';

  async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
    const page = options?.cursor ? parseInt(options.cursor) : 1;
    const limit = options?.limit || 100;

    try {
      // Fetch all transactions for the address
      const allTxs = await this.fetchFromArbiscan(address, page, limit);
      
      // Filter to only include transactions interacting with Variational contracts
      const variationalTxs = allTxs.filter(tx => this.isVariationalTx(tx));
      
      // Normalize transactions
      const transactions: NormalizedTransaction[] = variationalTxs.map(tx => 
        this.normalizeTx(tx, address)
      );

      const hasMore = allTxs.length === limit;

      return {
        transactions,
        nextCursor: hasMore ? String(page + 1) : undefined,
        hasMore,
        totalCount: undefined,
      };
    } catch (error) {
      console.error('Variational fetch error:', error);
      throw error;
    }
  }

  private async fetchFromArbiscan(
    address: string,
    page: number,
    limit: number
  ): Promise<ArbiscanTxResponse['result']> {
    const params = new URLSearchParams({
      module: 'account',
      action: 'txlist',
      address,
      page: String(page),
      offset: String(limit),
      sort: 'desc',
    });

    if (this.apiKey) {
      params.append('apikey', this.apiKey);
    }

    const url = `${this.apiBase}?${params.toString()}`;
    
    const response = await fetch(CORS_PROXY + encodeURIComponent(url), {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Arbiscan API error: ${response.status}`);
    }

    const data: ArbiscanTxResponse = await response.json();
    
    if (data.status !== '1') {
      if (data.message === 'No transactions found' || data.message === 'OK') {
        return [];
      }
      throw new Error(data.message || 'Arbiscan API error');
    }

    return data.result || [];
  }

  private isVariationalTx(tx: ArbiscanTxResponse['result'][0]): boolean {
    const to = tx.to?.toLowerCase() || '';
    const from = tx.from?.toLowerCase() || '';
    
    // Check if transaction involves Variational contracts
    const variationalAddresses = Object.values(VARIATIONAL_CONTRACTS).map(a => a.toLowerCase());
    
    return variationalAddresses.includes(to) || variationalAddresses.includes(from);
  }

  private normalizeTx(
    tx: ArbiscanTxResponse['result'][0],
    address: string
  ): NormalizedTransaction {
    const from = tx.from?.toLowerCase() || '';
    const to = tx.to?.toLowerCase() || '';
    const isOutgoing = from === address.toLowerCase();
    const isSelf = from === to;

    // Determine transaction type from method signature
    const methodId = tx.methodId || tx.input?.slice(0, 10) || '0x';
    const type = this.determineType(methodId, tx.functionName);

    // Calculate fee
    const gasUsed = BigInt(tx.gasUsed || '0');
    const gasPrice = BigInt(tx.gasPrice || '0');
    const fee = this.formatWei((gasUsed * gasPrice).toString());

    // Determine direction based on type
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

    // Determine counterparty
    let counterparty = isOutgoing ? to : from;
    if (this.isVariationalContract(to)) {
      counterparty = this.getContractName(to);
    }

    return {
      chainId: this.chainInfo.id,
      address,
      datetimeUtc: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
      hash: tx.hash,
      type,
      direction,
      counterparty,
      asset: 'ETH',
      amount: this.formatWei(tx.value),
      fee,
      feeAsset: 'ETH',
      status: tx.isError === '0' ? 'success' : 'failed',
      block: tx.blockNumber,
      explorerUrl: this.getExplorerUrl(tx.hash),
      notes: tx.functionName || '',
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
