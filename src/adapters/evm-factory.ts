import { ChainAdapter, ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

export interface EvmChainConfig {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  explorerUrl: string;
  addressPlaceholder: string;
  apiBase: string;
  apiType: 'blockscout' | 'etherscan';
  apiKey?: string;
  decimals?: number;
}

interface BlockscoutTx {
  hash: string;
  block_number: number;
  timestamp: string;
  from: { hash: string } | null;
  to: { hash: string } | null;
  value: string;
  fee: { value: string } | null;
  gas_limit: string;
  gas_price: string;
  gas_used: string;
  status: string;
  method: string | null;
  decoded_input: { method_call: string } | null;
  transaction_types: string[];
  has_error_in_internal_transactions: boolean;
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

interface EtherscanTx {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  functionName: string;
  input: string;
}

interface EtherscanResponse {
  status: string;
  message: string;
  result: EtherscanTx[];
}

function formatWei(wei: string, decimals: number = 18): string {
  if (!wei || wei === '0') return '0';
  try {
    const value = BigInt(wei);
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

function determineTypeFromBlockscout(tx: BlockscoutTx): string {
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

function determineTypeFromEtherscan(tx: EtherscanTx): string {
  if (!tx.input || tx.input === '0x') return 'transfer';
  const methodId = tx.input.slice(0, 10).toLowerCase();
  if (methodId === '0xa9059cbb' || methodId === '0x23b872dd') return 'token_transfer';
  if (methodId === '0x095ea7b3') return 'approve';
  if (methodId === '0x38ed1739' || methodId === '0x7ff36ab5' || methodId === '0x18cbafe5') return 'swap';
  if (tx.functionName?.toLowerCase().includes('swap')) return 'swap';
  if (tx.functionName?.toLowerCase().includes('stake')) return 'stake';
  if (tx.functionName?.toLowerCase().includes('claim')) return 'claim';
  return 'contract';
}

export function createEvmAdapter(config: EvmChainConfig): ChainAdapter {
  const chainInfo: ChainInfo = {
    id: config.id,
    name: config.name,
    symbol: config.symbol,
    logo: config.logo,
    explorerUrl: config.explorerUrl,
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    addressPlaceholder: config.addressPlaceholder,
  };

  const decimals = config.decimals || 18;

  async function fetchBlockscout(address: string, options?: FetchOptions): Promise<FetchResult> {
    let url = `${config.apiBase}/addresses/${address}/transactions`;
    
    if (options?.cursor) {
      url += `?${options.cursor}`;
    }
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`${config.name} API error: ${response.status}`);
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
        chainId: config.id,
        address,
        datetimeUtc: tx.timestamp,
        hash: tx.hash,
        type: determineTypeFromBlockscout(tx),
        direction: isSelf ? 'self' : (isIncoming ? 'in' : 'out'),
        counterparty: isIncoming ? fromAddr : toAddr,
        asset: config.symbol,
        amount: formatWei(tx.value, decimals),
        fee: formatWei(tx.fee?.value || '0', decimals),
        feeAsset: config.symbol,
        status: tx.status === 'ok' ? 'success' : 'failed',
        block: String(tx.block_number),
        explorerUrl: `${config.explorerUrl}/tx/${tx.hash}`,
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
  }

  async function fetchEtherscan(address: string, options?: FetchOptions): Promise<FetchResult> {
    const page = options?.cursor ? parseInt(options.cursor) : 1;
    const limit = options?.limit || 100;
    
    let url = `${config.apiBase}?module=account&action=txlist&address=${address}&page=${page}&offset=${limit}&sort=desc`;
    if (config.apiKey) {
      url += `&apikey=${config.apiKey}`;
    }
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`${config.name} API error: ${response.status}`);
    }

    const data: EtherscanResponse = await response.json();
    
    if (data.status !== '1' && data.message !== 'No transactions found') {
      if (data.message?.includes('rate limit')) {
        throw new Error(`${config.name} API rate limit exceeded. Please try again later.`);
      }
      throw new Error(data.message || `${config.name} API error`);
    }

    const txs = data.result || [];

    const transactions: NormalizedTransaction[] = txs.map((tx) => {
      const fromAddr = tx.from?.toLowerCase() || '';
      const toAddr = tx.to?.toLowerCase() || '';
      const addrLower = address.toLowerCase();
      
      const isIncoming = toAddr === addrLower;
      const isSelf = fromAddr === toAddr;
      
      const fee = (BigInt(tx.gasUsed || '0') * BigInt(tx.gasPrice || '0')).toString();
      
      return {
        chainId: config.id,
        address,
        datetimeUtc: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        hash: tx.hash,
        type: determineTypeFromEtherscan(tx),
        direction: isSelf ? 'self' : (isIncoming ? 'in' : 'out'),
        counterparty: isIncoming ? fromAddr : toAddr,
        asset: config.symbol,
        amount: formatWei(tx.value, decimals),
        fee: formatWei(fee, decimals),
        feeAsset: config.symbol,
        status: tx.isError === '0' ? 'success' : 'failed',
        block: tx.blockNumber,
        explorerUrl: `${config.explorerUrl}/tx/${tx.hash}`,
        notes: tx.functionName || '',
        tag: '',
        pnl: '0',
        rawDetails: tx as unknown as Record<string, unknown>,
      };
    });

    const hasMore = txs.length === limit;

    return {
      transactions,
      nextCursor: hasMore ? String(page + 1) : undefined,
      hasMore,
    };
  }

  return {
    chainInfo,
    validateAddress(address: string): boolean {
      return chainInfo.addressRegex.test(address);
    },
    async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
      try {
        if (config.apiType === 'blockscout') {
          return await fetchBlockscout(address, options);
        } else {
          return await fetchEtherscan(address, options);
        }
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

export const evmChainConfigs: EvmChainConfig[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    explorerUrl: 'https://etherscan.io',
    addressPlaceholder: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    apiBase: 'https://eth.blockscout.com/api/v2',
    apiType: 'blockscout',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    symbol: 'ETH',
    logo: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    explorerUrl: 'https://arbiscan.io',
    addressPlaceholder: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    apiBase: 'https://arbitrum.blockscout.com/api/v2',
    apiType: 'blockscout',
  },
  {
    id: 'optimism',
    name: 'Optimism',
    symbol: 'ETH',
    logo: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
    explorerUrl: 'https://optimistic.etherscan.io',
    addressPlaceholder: '0x4200000000000000000000000000000000000042',
    apiBase: 'https://optimism.blockscout.com/api/v2',
    apiType: 'blockscout',
  },
  {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    logo: 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/symbol/Base_Symbol_Blue.png',
    explorerUrl: 'https://basescan.org',
    addressPlaceholder: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    apiBase: 'https://base.blockscout.com/api/v2',
    apiType: 'blockscout',
  },
  {
    id: 'polygon',
    name: 'Polygon PoS',
    symbol: 'POL',
    logo: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    explorerUrl: 'https://polygonscan.com',
    addressPlaceholder: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    apiBase: 'https://polygon.blockscout.com/api/v2',
    apiType: 'blockscout',
  },
  {
    id: 'zksync',
    name: 'zkSync Era',
    symbol: 'ETH',
    logo: 'https://cryptologos.cc/logos/zksync-zks-logo.png',
    explorerUrl: 'https://explorer.zksync.io',
    addressPlaceholder: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E',
    apiBase: 'https://zksync.blockscout.com/api/v2',
    apiType: 'blockscout',
  },
  {
    id: 'immutable',
    name: 'Immutable zkEVM',
    symbol: 'IMX',
    logo: 'https://cryptologos.cc/logos/immutable-x-imx-logo.png',
    explorerUrl: 'https://explorer.immutable.com',
    addressPlaceholder: '0x52A6c53869Ce09a731CD772f245b97A4401d3348',
    apiBase: 'https://explorer.immutable.com/api/v2',
    apiType: 'blockscout',
  },
  {
    id: 'oasys',
    name: 'Oasys',
    symbol: 'OAS',
    logo: 'https://assets.coingecko.com/coins/images/29540/large/oasys.png',
    explorerUrl: 'https://explorer.oasys.games',
    addressPlaceholder: '0x5200000000000000000000000000000000000001',
    apiBase: 'https://explorer.oasys.games/api/v2',
    apiType: 'blockscout',
  },
  {
    id: 'beam',
    name: 'Beam',
    symbol: 'BEAM',
    logo: 'https://assets.coingecko.com/coins/images/32417/large/beam.png',
    explorerUrl: 'https://subnets.avax.network/beam',
    addressPlaceholder: '0x76BF5E7d2Bcb06b1444C0a2742780051D8D0E304',
    apiBase: 'https://api.routescan.io/v2/network/mainnet/evm/4337/etherscan/api',
    apiType: 'etherscan',
  },
  {
    id: 'moonbeam',
    name: 'Moonbeam',
    symbol: 'GLMR',
    logo: 'https://cryptologos.cc/logos/moonbeam-glmr-logo.png',
    explorerUrl: 'https://moonscan.io',
    addressPlaceholder: '0xAcc15dC74880C9944775448304B263D191c6077F',
    apiBase: 'https://moonbeam.blockscout.com/api/v2',
    apiType: 'blockscout',
  },
];

export function generateEvmAdapters(): Record<string, ChainAdapter> {
  const adapters: Record<string, ChainAdapter> = {};
  for (const config of evmChainConfigs) {
    adapters[config.id] = createEvmAdapter(config);
  }
  return adapters;
}
