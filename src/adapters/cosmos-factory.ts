import { ChainAdapter, ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

// Check if we're on a deployed environment with CORS proxy support
const isDeployedWithProxy = () => {
  if (typeof window === 'undefined') return false;
  // Vercel deployments or custom domains have the proxy available
  return window.location.hostname.includes('vercel.app') || 
         !window.location.hostname.includes('localhost');
};

// Use local Vercel proxy when deployed, fallback to allorigins for local dev
const getProxyUrl = () => {
  if (isDeployedWithProxy()) {
    return '/api/proxy?url=';
  }
  // Fallback to allorigins for local development
  return 'https://api.allorigins.win/raw?url=';
};

const CORS_PROXY = getProxyUrl();

// Cosmos chains are fully supported when deployed with proxy, limited otherwise
const IS_COSMOS_LIMITED = !isDeployedWithProxy();

export interface CosmosChainConfig {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  explorerUrl: string;
  addressPrefix: string;
  addressPlaceholder: string;
  lcdEndpoints: string[];
  decimals: number;
  denom: string;
}

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
          delegator_address?: string;
          validator_address?: string;
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

function formatAmount(amount: string, decimals: number): string {
  if (!amount || amount === '0') return '0';
  try {
    const value = parseFloat(amount) / Math.pow(10, decimals);
    return value.toFixed(Math.min(decimals, 8)).replace(/\.?0+$/, '') || '0';
  } catch {
    return '0';
  }
}

function formatDenom(denom: string, config: CosmosChainConfig): string {
  if (denom === config.denom) return config.symbol;
  if (denom.startsWith('u') && denom.length > 1) return denom.slice(1).toUpperCase();
  if (denom.startsWith('ibc/')) return `IBC/${denom.slice(4, 10)}...`;
  if (denom.startsWith('gamm/pool/')) return `LP-${denom.split('/')[2]}`;
  if (denom.startsWith('factory/')) return denom.split('/').pop()?.toUpperCase() || denom;
  return denom.toUpperCase();
}

interface ParsedMessage {
  type: string;
  direction: 'in' | 'out' | 'self' | 'unknown';
  counterparty: string;
  asset: string;
  amount: string;
}

function parseMessage(
  msg: CosmosTxResponse['tx_responses'][0]['tx']['body']['messages'][0],
  msgType: string,
  address: string,
  config: CosmosChainConfig
): ParsedMessage {
  const addrLower = address.toLowerCase();

  if (msgType.includes('MsgSend')) {
    const from = msg.from_address || '';
    const to = msg.to_address || '';
    const amounts = msg.amount || [];
    const coin = amounts[0] || { denom: config.denom, amount: '0' };
    
    const isOutgoing = from.toLowerCase() === addrLower;
    const isSelf = from.toLowerCase() === to.toLowerCase();
    
    return {
      type: 'transfer',
      direction: isSelf ? 'self' : (isOutgoing ? 'out' : 'in'),
      counterparty: isOutgoing ? to : from,
      asset: formatDenom(coin.denom, config),
      amount: formatAmount(coin.amount, config.decimals),
    };
  }

  if (msgType.includes('MsgTransfer')) {
    const sender = msg.sender || '';
    const receiver = msg.receiver || '';
    const token = msg.token || { denom: config.denom, amount: '0' };
    
    const isOutgoing = sender.toLowerCase() === addrLower;
    
    return {
      type: 'ibc_transfer',
      direction: isOutgoing ? 'out' : 'in',
      counterparty: isOutgoing ? receiver : sender,
      asset: formatDenom(token.denom, config),
      amount: formatAmount(token.amount, config.decimals),
    };
  }

  if (msgType.includes('MsgSwap') || msgType.includes('MsgSwapExact')) {
    return {
      type: 'swap',
      direction: 'out',
      counterparty: `${config.name} DEX`,
      asset: config.symbol,
      amount: '0',
    };
  }

  if (msgType.includes('MsgDelegate') && !msgType.includes('Undelegate') && !msgType.includes('Redelegate')) {
    const amounts = msg.amount || [];
    const coin = amounts[0] || { denom: config.denom, amount: '0' };
    return {
      type: 'stake',
      direction: 'out',
      counterparty: msg.validator_address || 'Validator',
      asset: formatDenom(coin.denom, config),
      amount: formatAmount(coin.amount, config.decimals),
    };
  }

  if (msgType.includes('MsgUndelegate')) {
    const amounts = msg.amount || [];
    const coin = amounts[0] || { denom: config.denom, amount: '0' };
    return {
      type: 'unstake',
      direction: 'in',
      counterparty: msg.validator_address || 'Validator',
      asset: formatDenom(coin.denom, config),
      amount: formatAmount(coin.amount, config.decimals),
    };
  }

  if (msgType.includes('MsgBeginRedelegate')) {
    return {
      type: 'redelegate',
      direction: 'self',
      counterparty: 'Validator',
      asset: config.symbol,
      amount: '0',
    };
  }

  if (msgType.includes('MsgWithdrawDelegatorReward') || msgType.includes('MsgWithdrawRewards')) {
    return {
      type: 'claim',
      direction: 'in',
      counterparty: 'Staking Rewards',
      asset: config.symbol,
      amount: '0',
    };
  }

  if (msgType.includes('MsgJoinPool') || msgType.includes('MsgJoinSwapExternAmountIn')) {
    return {
      type: 'add_liquidity',
      direction: 'out',
      counterparty: `${config.name} Pool`,
      asset: 'LP',
      amount: '0',
    };
  }

  if (msgType.includes('MsgExitPool') || msgType.includes('MsgExitSwapShareAmountIn')) {
    return {
      type: 'remove_liquidity',
      direction: 'in',
      counterparty: `${config.name} Pool`,
      asset: 'LP',
      amount: '0',
    };
  }

  if (msgType.includes('MsgVote')) {
    return {
      type: 'vote',
      direction: 'self',
      counterparty: 'Governance',
      asset: config.symbol,
      amount: '0',
    };
  }

  if (msgType.includes('MsgExecuteContract') || msgType.includes('MsgInstantiateContract')) {
    return {
      type: 'contract',
      direction: 'out',
      counterparty: 'Smart Contract',
      asset: config.symbol,
      amount: '0',
    };
  }

  const shortType = msgType.split('.').pop() || 'unknown';
  return {
    type: shortType.replace('Msg', '').toLowerCase(),
    direction: 'unknown',
    counterparty: '',
    asset: config.symbol,
    amount: '0',
  };
}

export function createCosmosAdapter(config: CosmosChainConfig): ChainAdapter {
  const chainInfo: ChainInfo = {
    id: config.id,
    name: config.name,
    symbol: config.symbol,
    logo: config.logo,
    explorerUrl: config.explorerUrl,
    addressRegex: new RegExp(`^${config.addressPrefix}1[a-z0-9]{38}$`),
    addressPlaceholder: config.addressPlaceholder,
    limited: IS_COSMOS_LIMITED,
  };

  async function fetchTxsFromLCD(
    address: string,
    direction: 'sender' | 'recipient',
    limit: number,
    offset: number
  ): Promise<NormalizedTransaction[]> {
    const eventKey = direction === 'sender' ? 'message.sender' : 'transfer.recipient';
    const query = `${eventKey}='${address}'`;
    
    let lastError: Error | null = null;
    
    for (const baseUrl of config.lcdEndpoints) {
      try {
        const url = `${baseUrl}/cosmos/tx/v1beta1/txs?events=${encodeURIComponent(query)}&pagination.limit=${limit}&pagination.offset=${offset}&order_by=ORDER_BY_DESC`;
        
        const response = await fetch(CORS_PROXY + encodeURIComponent(url), {
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: CosmosTxResponse = await response.json();
        return normalizeTxs(data.tx_responses || [], address, config);
      } catch (error) {
        lastError = error as Error;
        console.warn(`${config.name} LCD endpoint ${baseUrl} failed:`, error);
        continue;
      }
    }

    throw lastError || new Error(`All ${config.name} LCD endpoints failed`);
  }

  function normalizeTxs(
    txResponses: CosmosTxResponse['tx_responses'],
    address: string,
    cfg: CosmosChainConfig
  ): NormalizedTransaction[] {
    return txResponses.map((tx) => {
      const messages = tx.tx?.body?.messages || [];
      const firstMsg = messages[0] || {};
      const msgType = firstMsg['@type'] || '';
      
      const { type, direction, counterparty, asset, amount } = parseMessage(firstMsg, msgType, address, cfg);
      
      const feeAmounts = tx.tx?.auth_info?.fee?.amount || [];
      const fee = feeAmounts.length > 0 ? formatAmount(feeAmounts[0].amount, cfg.decimals) : '0';

      return {
        chainId: cfg.id,
        address,
        datetimeUtc: tx.timestamp || new Date().toISOString(),
        hash: tx.txhash,
        type,
        direction,
        counterparty,
        asset,
        amount,
        fee,
        feeAsset: cfg.symbol,
        status: tx.code === 0 ? 'success' : 'failed',
        block: tx.height,
        explorerUrl: `${cfg.explorerUrl}/tx/${tx.txhash}`,
        notes: tx.tx?.body?.memo || '',
        tag: '',
        pnl: '',
        rawDetails: tx as unknown as Record<string, unknown>,
      };
    });
  }

  return {
    chainInfo,
    validateAddress(address: string): boolean {
      return chainInfo.addressRegex.test(address);
    },
    async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
      const limit = options?.limit || 50;
      const offset = options?.cursor ? parseInt(options.cursor) : 0;

      try {
        const [sentTxs, receivedTxs] = await Promise.all([
          fetchTxsFromLCD(address, 'sender', limit, offset),
          fetchTxsFromLCD(address, 'recipient', limit, offset),
        ]);

        const allTxs = [...sentTxs, ...receivedTxs];
        const uniqueTxs = Array.from(new Map(allTxs.map(tx => [tx.hash, tx])).values());
        
        uniqueTxs.sort((a, b) => new Date(b.datetimeUtc).getTime() - new Date(a.datetimeUtc).getTime());

        const transactions = uniqueTxs.slice(0, limit);
        const hasMore = uniqueTxs.length >= limit;

        return {
          transactions,
          nextCursor: hasMore ? String(offset + limit) : undefined,
          hasMore,
          totalCount: uniqueTxs.length,
        };
      } catch (error) {
        console.error(`${config.name} fetch error:`, error);
        throw error;
      }
    },
    getExplorerUrl(hash: string): string {
      return `${config.explorerUrl}/tx/${hash}`;
    },
  };
}

export const cosmosChainConfigs: CosmosChainConfig[] = [
  {
    id: 'osmosis',
    name: 'Osmosis',
    symbol: 'OSMO',
    logo: 'https://cryptologos.cc/logos/osmosis-osmo-logo.png',
    explorerUrl: 'https://www.mintscan.io/osmosis',
    addressPrefix: 'osmo',
    addressPlaceholder: 'osmo1clpqr4nrk4khgkxj78fcwwh6dl3uw4ep88n0y4',
    lcdEndpoints: [
      'https://lcd.osmosis.zone',
      'https://rest.osmosis.goldenratiostaking.net',
      'https://rest.lavenderfive.com:443/osmosis',
      'https://rest-osmosis.ecostake.com',
      'https://osmosis-api.polkachu.com',
    ],
    decimals: 6,
    denom: 'uosmo',
  },
  {
    id: 'cosmos',
    name: 'Cosmos Hub',
    symbol: 'ATOM',
    logo: 'https://cryptologos.cc/logos/cosmos-atom-logo.png',
    explorerUrl: 'https://www.mintscan.io/cosmos',
    addressPrefix: 'cosmos',
    addressPlaceholder: 'cosmos1clpqr4nrk4khgkxj78fcwwh6dl3uw4epasmvnj',
    lcdEndpoints: [
      'https://lcd-cosmoshub.keplr.app',
      'https://cosmos-lcd.quickapi.com',
      'https://rest.cosmos.directory/cosmoshub',
      'https://cosmos-rest.publicnode.com',
    ],
    decimals: 6,
    denom: 'uatom',
  },
  {
    id: 'celestia',
    name: 'Celestia',
    symbol: 'TIA',
    logo: 'https://assets.coingecko.com/coins/images/31967/large/celestia.png',
    explorerUrl: 'https://www.mintscan.io/celestia',
    addressPrefix: 'celestia',
    addressPlaceholder: 'celestia1clpqr4nrk4khgkxj78fcwwh6dl3uw4ep5xmdtf',
    lcdEndpoints: [
      'https://celestia-lcd.publicnode.com',
      'https://rest.cosmos.directory/celestia',
      'https://celestia-api.polkachu.com',
    ],
    decimals: 6,
    denom: 'utia',
  },
  {
    id: 'dydx',
    name: 'dYdX Chain',
    symbol: 'DYDX',
    logo: 'https://cryptologos.cc/logos/dydx-dydx-logo.png',
    explorerUrl: 'https://www.mintscan.io/dydx',
    addressPrefix: 'dydx',
    addressPlaceholder: 'dydx1clpqr4nrk4khgkxj78fcwwh6dl3uw4epx5m8t2',
    lcdEndpoints: [
      'https://dydx-lcd.publicnode.com',
      'https://rest.cosmos.directory/dydx',
      'https://dydx-api.polkachu.com',
    ],
    decimals: 18,
    denom: 'adydx',
  },
  {
    id: 'sei',
    name: 'Sei',
    symbol: 'SEI',
    logo: 'https://assets.coingecko.com/coins/images/28205/large/sei.png',
    explorerUrl: 'https://www.mintscan.io/sei',
    addressPrefix: 'sei',
    addressPlaceholder: 'sei1clpqr4nrk4khgkxj78fcwwh6dl3uw4ep88n0y4',
    lcdEndpoints: [
      'https://sei-lcd.publicnode.com',
      'https://rest.cosmos.directory/sei',
      'https://sei-api.polkachu.com',
    ],
    decimals: 6,
    denom: 'usei',
  },
  {
    id: 'injective',
    name: 'Injective',
    symbol: 'INJ',
    logo: 'https://cryptologos.cc/logos/injective-inj-logo.png',
    explorerUrl: 'https://www.mintscan.io/injective',
    addressPrefix: 'inj',
    addressPlaceholder: 'inj1clpqr4nrk4khgkxj78fcwwh6dl3uw4ep88n0y4',
    lcdEndpoints: [
      'https://injective-lcd.publicnode.com',
      'https://rest.cosmos.directory/injective',
      'https://injective-api.polkachu.com',
    ],
    decimals: 18,
    denom: 'inj',
  },
  {
    id: 'neutron',
    name: 'Neutron',
    symbol: 'NTRN',
    logo: 'https://assets.coingecko.com/coins/images/30308/large/neutron.png',
    explorerUrl: 'https://www.mintscan.io/neutron',
    addressPrefix: 'neutron',
    addressPlaceholder: 'neutron1clpqr4nrk4khgkxj78fcwwh6dl3uw4ep88n0y4',
    lcdEndpoints: [
      'https://neutron-lcd.publicnode.com',
      'https://rest.cosmos.directory/neutron',
      'https://neutron-api.polkachu.com',
    ],
    decimals: 6,
    denom: 'untrn',
  },
  {
    id: 'noble',
    name: 'Noble',
    symbol: 'USDC',
    logo: 'https://assets.coingecko.com/coins/images/30420/large/noble.png',
    explorerUrl: 'https://www.mintscan.io/noble',
    addressPrefix: 'noble',
    addressPlaceholder: 'noble1clpqr4nrk4khgkxj78fcwwh6dl3uw4ep88n0y4',
    lcdEndpoints: [
      'https://noble-lcd.publicnode.com',
      'https://rest.cosmos.directory/noble',
      'https://noble-api.polkachu.com',
    ],
    decimals: 6,
    denom: 'uusdc',
  },
];

export function generateCosmosAdapters(): Record<string, ChainAdapter> {
  const adapters: Record<string, ChainAdapter> = {};
  for (const config of cosmosChainConfigs) {
    adapters[config.id] = createCosmosAdapter(config);
  }
  return adapters;
}
