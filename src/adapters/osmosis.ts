import { ChainAdapter, ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

interface CosmosTxResponse {
  tx_responses: Array<{
    txhash: string;
    height: string;
    timestamp: string;
    code: number;
    tx: {
      body: {
        messages: Array<{
          '@type': string;
          from_address?: string;
          to_address?: string;
          amount?: Array<{ denom: string; amount: string }>;
          sender?: string;
          receiver?: string;
          token?: { denom: string; amount: string };
          source_channel?: string;
        }>;
        memo?: string;
      };
      auth_info: {
        fee: {
          amount: Array<{ denom: string; amount: string }>;
        };
      };
    };
    logs?: Array<{
      events: Array<{
        type: string;
        attributes: Array<{ key: string; value: string }>;
      }>;
    }>;
  }>;
  pagination?: {
    total: string;
    next_key?: string;
  };
}

export class OsmosisAdapter implements ChainAdapter {
  chainInfo: ChainInfo = {
    id: 'osmosis',
    name: 'Osmosis',
    symbol: 'OSMO',
    logo: 'https://cryptologos.cc/logos/osmosis-osmo-logo.png',
    explorerUrl: 'https://www.mintscan.io/osmosis',
    addressRegex: /^osmo1[a-z0-9]{38}$/,
    addressPlaceholder: 'osmo1clpqr4nrk4khgkxj78fcwwh6dl3uw4ep88n0y4',
  };

  // Multiple REST endpoints for failover (from cosmos chain-registry)
  private restEndpoints = [
    'https://lcd.osmosis.zone',
    'https://rest.osmosis.goldenratiostaking.net',
    'https://rest.lavenderfive.com:443/osmosis',
    'https://rest-osmosis.ecostake.com',
    'https://osmosis-api.polkachu.com',
  ];

  validateAddress(address: string): boolean {
    return this.chainInfo.addressRegex.test(address);
  }

  async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
    const limit = options?.limit || 50;
    const offset = options?.cursor ? parseInt(options.cursor) : 0;

    try {
      // Fetch sent and received transactions using LCD REST API
      const [sentTxs, receivedTxs] = await Promise.all([
        this.fetchTxsFromLCD(address, 'sender', limit, offset),
        this.fetchTxsFromLCD(address, 'recipient', limit, offset),
      ]);

      // Merge and deduplicate transactions
      const allTxs = [...sentTxs, ...receivedTxs];
      const uniqueTxs = Array.from(new Map(allTxs.map(tx => [tx.hash, tx])).values());
      
      // Sort by timestamp descending
      uniqueTxs.sort((a, b) => new Date(b.datetimeUtc).getTime() - new Date(a.datetimeUtc).getTime());

      // Apply limit
      const transactions = uniqueTxs.slice(0, limit);
      const hasMore = uniqueTxs.length >= limit;

      return {
        transactions,
        nextCursor: hasMore ? String(offset + limit) : undefined,
        hasMore,
        totalCount: uniqueTxs.length,
      };
    } catch (error) {
      console.error('Osmosis fetch error:', error);
      throw error;
    }
  }

  private async fetchTxsFromLCD(
    address: string,
    direction: 'sender' | 'recipient',
    limit: number,
    offset: number
  ): Promise<NormalizedTransaction[]> {
    const eventKey = direction === 'sender' ? 'message.sender' : 'transfer.recipient';
    const query = `${eventKey}='${address}'`;
    
    // Try each endpoint until one works
    let lastError: Error | null = null;
    
    for (const baseUrl of this.restEndpoints) {
      try {
        const url = `${baseUrl}/cosmos/tx/v1beta1/txs?events=${encodeURIComponent(query)}&pagination.limit=${limit}&pagination.offset=${offset}&order_by=ORDER_BY_DESC`;
        
        const response = await fetch(CORS_PROXY + encodeURIComponent(url), {
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: CosmosTxResponse = await response.json();
        return this.normalizeTxs(data.tx_responses || [], address);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Osmosis LCD endpoint ${baseUrl} failed:`, error);
        continue;
      }
    }

    // All endpoints failed
    throw lastError || new Error('All Osmosis LCD endpoints failed');
  }

  private normalizeTxs(
    txResponses: CosmosTxResponse['tx_responses'],
    address: string
  ): NormalizedTransaction[] {
    return txResponses.map((tx) => {
      const messages = tx.tx?.body?.messages || [];
      const firstMsg = messages[0] || {};
      const msgType = firstMsg['@type'] || '';
      
      // Determine transaction type and extract details
      const { type, direction, counterparty, asset, amount } = this.parseMessage(firstMsg, msgType, address);
      
      // Extract fee
      const feeAmounts = tx.tx?.auth_info?.fee?.amount || [];
      const fee = feeAmounts.length > 0 ? this.formatAmount(feeAmounts[0].amount, feeAmounts[0].denom) : '0';

      return {
        chainId: this.chainInfo.id,
        address,
        datetimeUtc: tx.timestamp || new Date().toISOString(),
        hash: tx.txhash,
        type,
        direction,
        counterparty,
        asset,
        amount,
        fee,
        feeAsset: 'OSMO',
        status: tx.code === 0 ? 'success' : 'failed',
        block: tx.height,
        explorerUrl: this.getExplorerUrl(tx.txhash),
        notes: tx.tx?.body?.memo || '',
        tag: '',
        pnl: '',
        rawDetails: tx as unknown as Record<string, unknown>,
      };
    });
  }

  private parseMessage(
    msg: CosmosTxResponse['tx_responses'][0]['tx']['body']['messages'][0],
    msgType: string,
    address: string
  ): { type: string; direction: 'in' | 'out' | 'self' | 'unknown'; counterparty: string; asset: string; amount: string } {
    // MsgSend - standard transfer
    if (msgType.includes('MsgSend')) {
      const from = msg.from_address || '';
      const to = msg.to_address || '';
      const amounts = msg.amount || [];
      const coin = amounts[0] || { denom: 'uosmo', amount: '0' };
      
      const isOutgoing = from.toLowerCase() === address.toLowerCase();
      const isSelf = from.toLowerCase() === to.toLowerCase();
      
      return {
        type: 'transfer',
        direction: isSelf ? 'self' : (isOutgoing ? 'out' : 'in'),
        counterparty: isOutgoing ? to : from,
        asset: this.formatDenom(coin.denom),
        amount: this.formatAmount(coin.amount, coin.denom),
      };
    }

    // MsgTransfer - IBC transfer
    if (msgType.includes('MsgTransfer')) {
      const sender = msg.sender || '';
      const receiver = msg.receiver || '';
      const token = msg.token || { denom: 'uosmo', amount: '0' };
      
      const isOutgoing = sender.toLowerCase() === address.toLowerCase();
      
      return {
        type: 'ibc_transfer',
        direction: isOutgoing ? 'out' : 'in',
        counterparty: isOutgoing ? receiver : sender,
        asset: this.formatDenom(token.denom),
        amount: this.formatAmount(token.amount, token.denom),
      };
    }

    // MsgSwapExactAmountIn / MsgSwapExactAmountOut - DEX swaps
    if (msgType.includes('MsgSwap')) {
      return {
        type: 'swap',
        direction: 'out',
        counterparty: 'Osmosis DEX',
        asset: 'OSMO',
        amount: '0',
      };
    }

    // MsgDelegate - staking
    if (msgType.includes('MsgDelegate') && !msgType.includes('Undelegate')) {
      return {
        type: 'stake',
        direction: 'out',
        counterparty: 'Validator',
        asset: 'OSMO',
        amount: '0',
      };
    }

    // MsgUndelegate - unstaking
    if (msgType.includes('MsgUndelegate')) {
      return {
        type: 'unstake',
        direction: 'in',
        counterparty: 'Validator',
        asset: 'OSMO',
        amount: '0',
      };
    }

    // MsgWithdrawDelegatorReward - claim rewards
    if (msgType.includes('MsgWithdrawDelegatorReward')) {
      return {
        type: 'claim',
        direction: 'in',
        counterparty: 'Staking Rewards',
        asset: 'OSMO',
        amount: '0',
      };
    }

    // MsgJoinPool / MsgExitPool - liquidity
    if (msgType.includes('MsgJoinPool')) {
      return {
        type: 'add_liquidity',
        direction: 'out',
        counterparty: 'Osmosis Pool',
        asset: 'LP',
        amount: '0',
      };
    }

    if (msgType.includes('MsgExitPool')) {
      return {
        type: 'remove_liquidity',
        direction: 'in',
        counterparty: 'Osmosis Pool',
        asset: 'LP',
        amount: '0',
      };
    }

    // Unknown message type
    const shortType = msgType.split('.').pop() || 'unknown';
    return {
      type: shortType,
      direction: 'unknown',
      counterparty: '',
      asset: 'OSMO',
      amount: '0',
    };
  }

  private formatDenom(denom: string): string {
    if (denom === 'uosmo') return 'OSMO';
    if (denom === 'uatom') return 'ATOM';
    if (denom === 'uusdc') return 'USDC';
    if (denom.startsWith('ibc/')) return `IBC/${denom.slice(4, 10)}...`;
    if (denom.startsWith('gamm/pool/')) return `LP-${denom.split('/')[2]}`;
    if (denom.startsWith('u') && denom.length > 1) return denom.slice(1).toUpperCase();
    return denom.toUpperCase();
  }

  private formatAmount(amount: string, denom: string): string {
    // Determine decimals based on denom
    const decimals = denom.startsWith('u') ? 6 : 
                     denom.startsWith('ibc/') ? 6 : 
                     denom.startsWith('gamm/') ? 18 : 6;
    
    try {
      const value = parseFloat(amount) / Math.pow(10, decimals);
      return value.toFixed(Math.min(decimals, 8)).replace(/\.?0+$/, '') || '0';
    } catch {
      return '0';
    }
  }

  getExplorerUrl(hash: string): string {
    return `${this.chainInfo.explorerUrl}/tx/${hash}`;
  }
}
