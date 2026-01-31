import { ChainAdapter, ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

interface RpcTxResult {
  hash: string;
  height: string;
  tx_result: {
    code: number;
    events: Array<{
      type: string;
      attributes: Array<{ key: string; value: string }>;
    }>;
  };
}

interface RpcTxSearchResponse {
  jsonrpc: string;
  result: {
    txs: RpcTxResult[];
    total_count: string;
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

  private rpcBase = 'https://osmosis-rpc.numia.xyz';
  private apiKey = 'sk_cab92b351e3c4be7a31dcd89ae18f684';

  validateAddress(address: string): boolean {
    return this.chainInfo.addressRegex.test(address);
  }

  async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
    const limit = options?.limit || 50;
    const page = options?.cursor ? parseInt(options.cursor) : 1;

    try {
      const senderQuery = `transfer.sender='${address}'`;
      const senderUrl = `${this.rpcBase}/tx_search?query="${encodeURIComponent(senderQuery)}"&per_page=${limit}&page=${page}&order_by="desc"`;
      
      const recipientQuery = `transfer.recipient='${address}'`;
      const recipientUrl = `${this.rpcBase}/tx_search?query="${encodeURIComponent(recipientQuery)}"&per_page=${limit}&page=${page}&order_by="desc"`;

      const headers = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      };

      const [senderRes, recipientRes] = await Promise.all([
        fetch(senderUrl, { headers }),
        fetch(recipientUrl, { headers }),
      ]);

      const senderData: RpcTxSearchResponse = senderRes.ok ? await senderRes.json() : { jsonrpc: '2.0', result: { txs: [], total_count: '0' } };
      const recipientData: RpcTxSearchResponse = recipientRes.ok ? await recipientRes.json() : { jsonrpc: '2.0', result: { txs: [], total_count: '0' } };

      const allTxs = [...(senderData.result?.txs || []), ...(recipientData.result?.txs || [])];
      const uniqueTxs = Array.from(new Map(allTxs.map(tx => [tx.hash, tx])).values());
      uniqueTxs.sort((a, b) => parseInt(b.height) - parseInt(a.height));

      const transactions: NormalizedTransaction[] = uniqueTxs.slice(0, limit).map((tx) => {
        const events = tx.tx_result?.events || [];
        const transferEvent = events.find(e => e.type === 'transfer');
        const messageEvent = events.find(e => e.type === 'message');
        
        const getAttr = (event: typeof events[0] | undefined, key: string) => {
          if (!event) return '';
          const attr = event.attributes.find(a => {
            try { return a.key === key || atob(a.key) === key; } catch { return a.key === key; }
          });
          if (!attr) return '';
          try { return atob(attr.value); } catch { return attr.value; }
        };

        const sender = getAttr(transferEvent, 'sender');
        const recipient = getAttr(transferEvent, 'recipient');
        const amountStr = getAttr(transferEvent, 'amount');
        const action = getAttr(messageEvent, 'action');
        
        const isIncoming = recipient.toLowerCase() === address.toLowerCase();
        const { amount, denom } = this.parseAmount(amountStr);

        return {
          chainId: this.chainInfo.id,
          address,
          datetimeUtc: new Date().toISOString(),
          hash: tx.hash,
          type: this.parseAction(action),
          direction: isIncoming ? 'in' : 'out',
          counterparty: isIncoming ? sender : recipient,
          asset: this.formatDenom(denom),
          amount: this.formatAmount(amount, denom),
          fee: '0',
          feeAsset: 'OSMO',
          status: tx.tx_result?.code === 0 ? 'success' : 'failed',
          block: tx.height,
          explorerUrl: this.getExplorerUrl(tx.hash),
          notes: '',
          tag: '',
          pnl: '',
          rawDetails: tx as unknown as Record<string, unknown>,
        };
      });

      const totalSender = parseInt(senderData.result?.total_count || '0');
      const totalRecipient = parseInt(recipientData.result?.total_count || '0');
      const hasMore = (page * limit) < Math.max(totalSender, totalRecipient);

      return {
        transactions,
        nextCursor: hasMore ? String(page + 1) : undefined,
        hasMore,
        totalCount: totalSender + totalRecipient,
      };
    } catch (error) {
      console.error('Osmosis fetch error:', error);
      throw error;
    }
  }

  private parseAmount(amountStr: string): { amount: string; denom: string } {
    if (!amountStr) return { amount: '0', denom: 'uosmo' };
    const match = amountStr.match(/^(\d+)(.+)$/);
    if (match) return { amount: match[1], denom: match[2] };
    return { amount: '0', denom: 'uosmo' };
  }

  private parseAction(action: string): string {
    if (!action) return 'unknown';
    if (action.includes('MsgSend')) return 'transfer';
    if (action.includes('MsgSwap') || action.includes('swap')) return 'swap';
    if (action.includes('MsgDelegate')) return 'stake';
    if (action.includes('MsgUndelegate')) return 'unstake';
    if (action.includes('MsgWithdraw')) return 'claim';
    if (action.includes('MsgJoinPool')) return 'add_liquidity';
    if (action.includes('MsgExitPool')) return 'remove_liquidity';
    if (action.includes('MsgTransfer')) return 'ibc_transfer';
    return 'contract';
  }

  private formatDenom(denom: string): string {
    if (denom === 'uosmo') return 'OSMO';
    if (denom === 'uatom') return 'ATOM';
    if (denom === 'uusdc') return 'USDC';
    if (denom.startsWith('ibc/')) return `IBC/${denom.slice(4, 10)}...`;
    if (denom.startsWith('gamm/pool/')) return `LP-${denom.split('/')[2]}`;
    return denom.toUpperCase();
  }

  private formatAmount(amount: string, denom: string): string {
    const decimals = denom.startsWith('u') ? 6 : 
                     denom.startsWith('ibc/') ? 6 : 0;
    const value = parseFloat(amount) / Math.pow(10, decimals);
    return value.toFixed(Math.min(decimals, 8));
  }

  getExplorerUrl(hash: string): string {
    return `${this.chainInfo.explorerUrl}/tx/${hash}`;
  }
}
