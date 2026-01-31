# Chain Integration Guide

This guide explains how to add support for a new blockchain to the Wallet Transaction Explorer. The project uses a modular adapter architecture that makes it straightforward to integrate additional chains.

## Architecture Overview

Each blockchain is supported through a **Chain Adapter** that implements a common interface. The adapter is responsible for:

1. Validating wallet addresses for the chain
2. Fetching transactions from the chain's API/indexer
3. Normalizing transaction data into a common format
4. Providing explorer URLs for transactions

## Step 1: Understand the Normalized Transaction Model

All adapters must convert chain-specific transaction data into this normalized format:

```typescript
interface NormalizedTransaction {
  chainId: string;           // Your chain's unique identifier (e.g., 'polkadot')
  address: string;           // The wallet address being queried
  datetimeUtc: string;       // ISO 8601 timestamp (e.g., '2024-01-15T10:30:00.000Z')
  hash: string;              // Transaction hash
  type: string;              // Transaction type (transfer, swap, stake, etc.)
  direction: 'in' | 'out' | 'self' | 'unknown';  // Relative to the queried wallet
  counterparty: string;      // The other address involved
  asset: string;             // Token symbol (e.g., 'DOT', 'ETH')
  amount: string;            // Human-readable amount (not raw/wei)
  fee: string;               // Transaction fee (human-readable)
  feeAsset: string;          // Fee token symbol
  status: 'success' | 'failed' | 'pending';
  block: string;             // Block number/height
  explorerUrl: string;       // Direct link to view on block explorer
  notes: string;             // Memo/note field if supported by chain
  tag: string;               // For Awaken CSV (open_position, close_position, etc.)
  pnl: string;               // Profit/loss if applicable
  rawDetails?: Record<string, unknown>;  // Original API response for debugging
}
```

## Step 2: Create Your Adapter File

Create a new file in `src/adapters/` named after your chain (e.g., `ethereum.ts`):

```typescript
import { BaseChainAdapter } from './base';
import { ChainInfo, FetchOptions, FetchResult, NormalizedTransaction } from '../types';

export class EthereumAdapter extends BaseChainAdapter {
  chainInfo: ChainInfo = {
    id: 'ethereum',                    // Unique identifier
    name: 'Ethereum',                  // Display name
    symbol: 'ETH',                     // Native token symbol
    logo: 'https://...',               // Logo URL (use cryptologos.cc or similar)
    explorerUrl: 'https://etherscan.io',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,  // Regex to validate addresses
    addressPlaceholder: '0x...',       // Example address for input placeholder
  };

  private apiBase = 'https://api.etherscan.io/api';

  async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
    // Implementation here - see detailed example below
  }

  // Override if your explorer uses a different URL pattern
  getExplorerUrl(hash: string): string {
    return `${this.chainInfo.explorerUrl}/tx/${hash}`;
  }
}
```

## Step 3: Implement fetchTransactions

This is the core method. Here's a detailed example:

```typescript
async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
  const page = options?.cursor ? parseInt(options.cursor) : 1;
  const limit = options?.limit || 100;

  try {
    // 1. Make API request to your chain's indexer
    const response = await fetch(
      `${this.apiBase}?module=account&action=txlist&address=${address}&page=${page}&offset=${limit}&sort=desc`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    // 2. Handle API-specific error responses
    if (data.status !== '1' && data.message !== 'No transactions found') {
      throw new Error(data.message || 'API error');
    }

    const txs = data.result || [];

    // 3. Transform each transaction to normalized format
    const transactions: NormalizedTransaction[] = txs.map((tx: any) => {
      const isIncoming = tx.to.toLowerCase() === address.toLowerCase();
      
      return {
        chainId: this.chainInfo.id,
        address,
        datetimeUtc: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        hash: tx.hash,
        type: this.determineType(tx),
        direction: isIncoming ? 'in' : 'out',
        counterparty: isIncoming ? tx.from : tx.to,
        asset: 'ETH',
        amount: this.formatWei(tx.value),
        fee: this.formatWei((BigInt(tx.gasUsed) * BigInt(tx.gasPrice)).toString()),
        feeAsset: 'ETH',
        status: tx.isError === '0' ? 'success' : 'failed',
        block: tx.blockNumber,
        explorerUrl: this.getExplorerUrl(tx.hash),
        notes: '',
        tag: '',
        pnl: '0',
        rawDetails: tx,
      };
    });

    // 4. Determine if there are more pages
    const hasMore = txs.length === limit;

    return {
      transactions,
      nextCursor: hasMore ? String(page + 1) : undefined,
      hasMore,
      totalCount: undefined,  // Set if API provides total count
    };
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Helper methods
private formatWei(wei: string): string {
  const value = BigInt(wei);
  const divisor = BigInt(10 ** 18);
  const intPart = value / divisor;
  const fracPart = value % divisor;
  return `${intPart}.${fracPart.toString().padStart(18, '0').slice(0, 8)}`;
}

private determineType(tx: any): string {
  if (!tx.input || tx.input === '0x') return 'transfer';
  // Add more type detection based on method signatures
  return 'contract';
}
```

## Step 4: Register Your Adapter

Add your adapter to `src/adapters/index.ts`:

```typescript
import { ChainAdapter } from '../types';
import { PolkadotAdapter } from './polkadot';
import { OsmosisAdapter } from './osmosis';
import { RoninAdapter } from './ronin';
import { EthereumAdapter } from './ethereum';  // Add import

export const adapters: Record<string, ChainAdapter> = {
  polkadot: new PolkadotAdapter(),
  osmosis: new OsmosisAdapter(),
  ronin: new RoninAdapter(),
  ethereum: new EthereumAdapter(),  // Add to registry
};

// ... rest of file
```

## Step 5: Test Your Integration

1. Run the development server: `npm run dev`
2. Select your chain from the dropdown
3. Enter a valid wallet address
4. Verify transactions load correctly
5. Test the CSV export
6. Check that explorer links work

## API/Indexer Recommendations by Chain Type

### EVM Chains (Ethereum, Polygon, BSC, etc.)
- Etherscan-style APIs (most have free tiers)
- The Graph subgraphs
- Alchemy/Infura enhanced APIs

### Cosmos Chains (Osmosis, Cosmos Hub, etc.)
- LCD REST endpoints (`/cosmos/tx/v1beta1/txs`)
- Mintscan API
- Big Dipper indexers

### Substrate Chains (Polkadot, Kusama, etc.)
- Subscan API
- Subsquid indexers

### Other Chains
- Check for official block explorer APIs
- Look for community-maintained indexers
- Consider running your own indexer for production

## Best Practices

1. **Handle Rate Limiting**: Implement exponential backoff or respect rate limit headers
2. **Cache Responses**: Consider caching for frequently accessed addresses
3. **Normalize Amounts**: Always convert from raw units to human-readable decimals
4. **Handle Errors Gracefully**: Return meaningful error messages
5. **Support Pagination**: Implement cursor-based pagination for large histories
6. **Test Edge Cases**: Empty wallets, failed transactions, contract interactions

## Transaction Type Detection

Common transaction types to detect:
- `transfer` - Simple token transfers
- `swap` - DEX trades
- `stake` / `unstake` - Staking operations
- `claim` - Reward claims
- `approve` - Token approvals
- `add_liquidity` / `remove_liquidity` - LP operations
- `bridge` - Cross-chain transfers
- `contract` - Generic contract interactions

## Awaken CSV Compatibility

The CSV export uses this format:
- Date: `MM/DD/YYYY HH:MM:SS` in UTC
- Asset: Token symbol
- Amount: Decimal amount
- Fee: Transaction fee
- P&L: Profit/loss (set to '0' if not applicable)
- Payment Token: Fee token symbol
- ID: Short identifier (first 16 chars of hash)
- Notes: Transaction type and direction
- Tag: `open_position`, `close_position`, or `funding_payment` (for perpetuals)
- Transaction Hash: Full hash

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b add-chainname-support`
3. Implement your adapter following this guide
4. Add tests if possible
5. Submit a pull request with:
   - Description of the chain
   - API/indexer used
   - Any rate limiting considerations
   - Example wallet addresses for testing

## Questions?

Open an issue on GitHub if you need help integrating a specific chain.
