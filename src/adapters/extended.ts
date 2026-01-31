import { ChainAdapter, ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

interface VoyagerTxResponse {
  items: Array<{
    hash: string;
    block_number: number;
    timestamp: number;
    type: string;
    status: string;
    contract_address?: string;
    entry_point_selector?: string;
    calldata?: string[];
    actual_fee?: string;
  }>;
  lastPage: number;
}

export class ExtendedAdapter implements ChainAdapter {
  chainInfo: ChainInfo = {
    id: 'extended',
    name: 'Extended (Starknet)',
    symbol: 'USDC',
    logo: 'https://cryptologos.cc/logos/starknet-token-strk-logo.png',
    explorerUrl: 'https://voyager.online',
    // Starknet addresses are 64 hex chars (252 bits)
    addressRegex: /^0x[a-fA-F0-9]{1,64}$/,
    addressPlaceholder: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
  };

  private voyagerApiBase = 'https://api.voyager.online/beta';

  validateAddress(address: string): boolean {
    return this.chainInfo.addressRegex.test(address);
  }

  async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
    const limit = options?.limit || 50;
    const page = options?.cursor ? parseInt(options.cursor) : 1;

    try {
      // Try to fetch from Voyager API for general Starknet transactions
      const transactions = await this.fetchFromVoyager(address, page, limit);
      
      const hasMore = transactions.length >= limit;

      return {
        transactions,
        nextCursor: hasMore ? String(page + 1) : undefined,
        hasMore,
        totalCount: undefined,
      };
    } catch (error) {
      console.error('Extended/Starknet fetch error:', error);
      throw error;
    }
  }

  private async fetchFromVoyager(
    address: string,
    page: number,
    limit: number
  ): Promise<NormalizedTransaction[]> {
    // Normalize address to ensure it has 0x prefix
    const normalizedAddress = address.startsWith('0x') ? address : `0x${address}`;
    
    const url = `${this.voyagerApiBase}/txns?to=${normalizedAddress}&ps=${limit}&p=${page}`;
    
    const response = await fetch(CORS_PROXY + encodeURIComponent(url), {
      headers: { 
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Voyager API failed, trying StarkScan...');
      return this.fetchFromStarkScan(normalizedAddress, page, limit);
    }

    const data: VoyagerTxResponse = await response.json();
    return this.normalizeVoyagerTxs(data.items || [], normalizedAddress);
  }

  private async fetchFromStarkScan(
    address: string,
    page: number,
    limit: number
  ): Promise<NormalizedTransaction[]> {
    // StarkScan API as fallback
    const url = `https://api.starkscan.co/api/v0/transactions?contract_address=${address}&limit=${limit}&page=${page}`;
    
    try {
      const response = await fetch(CORS_PROXY + encodeURIComponent(url), {
        headers: { 
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`StarkScan API error: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeStarkScanTxs(data.data || [], address);
    } catch (error) {
      console.error('StarkScan API error:', error);
      // Return empty array if both APIs fail
      return [];
    }
  }

  private normalizeVoyagerTxs(
    txs: VoyagerTxResponse['items'],
    address: string
  ): NormalizedTransaction[] {
    return txs.map((tx) => {
      const type = this.determineType(tx.type, tx.entry_point_selector);
      const direction = this.determineDirection(tx, address);

      return {
        chainId: this.chainInfo.id,
        address,
        datetimeUtc: new Date(tx.timestamp * 1000).toISOString(),
        hash: tx.hash,
        type,
        direction,
        counterparty: tx.contract_address || '',
        asset: 'USDC',
        amount: '0',
        fee: this.formatStarknetFee(tx.actual_fee || '0'),
        feeAsset: 'ETH',
        status: tx.status === 'ACCEPTED_ON_L2' || tx.status === 'ACCEPTED_ON_L1' ? 'success' : 
                tx.status === 'PENDING' ? 'pending' : 'failed',
        block: String(tx.block_number),
        explorerUrl: this.getExplorerUrl(tx.hash),
        notes: '',
        tag: this.getTag(type),
        pnl: '',
        rawDetails: tx as unknown as Record<string, unknown>,
      };
    });
  }

  private normalizeStarkScanTxs(
    txs: Array<Record<string, unknown>>,
    address: string
  ): NormalizedTransaction[] {
    return txs.map((tx) => {
      const hash = tx.transaction_hash as string || '';
      const timestamp = tx.timestamp as number || Date.now() / 1000;
      const blockNumber = tx.block_number as number || 0;
      const status = tx.transaction_status as string || '';

      return {
        chainId: this.chainInfo.id,
        address,
        datetimeUtc: new Date(timestamp * 1000).toISOString(),
        hash,
        type: 'contract',
        direction: 'unknown',
        counterparty: tx.contract_address as string || '',
        asset: 'USDC',
        amount: '0',
        fee: '0',
        feeAsset: 'ETH',
        status: status.includes('ACCEPTED') ? 'success' : 
                status === 'PENDING' ? 'pending' : 'failed',
        block: String(blockNumber),
        explorerUrl: this.getExplorerUrl(hash),
        notes: '',
        tag: '',
        pnl: '',
        rawDetails: tx,
      };
    });
  }

  private determineType(txType?: string, entryPointSelector?: string): string {
    if (!txType && !entryPointSelector) return 'contract';

    const type = txType?.toLowerCase() || '';
    const selector = entryPointSelector?.toLowerCase() || '';

    // Common Starknet entry point selectors
    if (selector.includes('transfer')) return 'transfer';
    if (selector.includes('approve')) return 'approve';
    if (selector.includes('swap')) return 'swap';
    if (selector.includes('deposit')) return 'deposit';
    if (selector.includes('withdraw')) return 'withdraw';
    
    // Extended Exchange specific
    if (selector.includes('open_position') || selector.includes('create_order')) return 'open_position';
    if (selector.includes('close_position') || selector.includes('cancel_order')) return 'close_position';
    if (selector.includes('liquidate')) return 'liquidation';
    if (selector.includes('settle') || selector.includes('funding')) return 'funding_payment';

    if (type === 'invoke') return 'contract';
    if (type === 'deploy') return 'deploy';
    if (type === 'declare') return 'declare';

    return 'contract';
  }

  private determineDirection(
    tx: VoyagerTxResponse['items'][0],
    address: string
  ): 'in' | 'out' | 'self' | 'unknown' {
    // For Starknet, direction is harder to determine without decoding calldata
    // Default to 'out' for invoke transactions from the address
    const contractAddress = tx.contract_address?.toLowerCase() || '';
    const normalizedAddress = address.toLowerCase();

    if (contractAddress === normalizedAddress) {
      return 'out';
    }

    return 'unknown';
  }

  private getTag(type: string): string {
    switch (type) {
      case 'open_position':
      case 'deposit':
        return 'open_position';
      case 'close_position':
      case 'withdraw':
        return 'close_position';
      case 'funding_payment':
      case 'liquidation':
        return 'funding_payment';
      default:
        return '';
    }
  }

  private formatStarknetFee(fee: string): string {
    try {
      // Starknet fees are in wei (10^18)
      const value = BigInt(fee);
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
