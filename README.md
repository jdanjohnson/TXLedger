# Wallet Transaction Explorer

A multi-chain blockchain wallet transaction explorer that fetches, displays, and exports wallet transactions in Awaken CSV format for tax reporting.

## Features

- **Multi-Chain Support**: Query transactions across multiple blockchains from a single interface
- **Transaction Table**: View transactions in a clean, sortable, and filterable table
- **Search & Filter**: Search by hash, address, or notes; filter by direction, type, and asset
- **Awaken CSV Export**: Export transactions in Awaken tax software format
- **Transaction Details**: Click any row to view full transaction details with block explorer links
- **Pagination**: Handle wallets with large transaction histories

## Supported Chains

| Chain | Status | API | Auth Required |
|-------|--------|-----|---------------|
| Polkadot | Active | Subscan API | No |
| Bittensor | Active | Taostats API | Yes (API Key) |
| Ronin | Active | Ronin Explorer API | No |
| Osmosis | Active | Cosmos LCD REST API | No |
| Variational | Active | Arbiscan API | No (free tier) |
| Extended | Active | Voyager/StarkScan API | No |

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/wallet-tx-viewer.git
cd wallet-tx-viewer

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Configuration

### API Keys

Some chains require API keys for full functionality. You can configure these in the adapter files or via environment variables.

#### Bittensor (Taostats API)

1. Get an API key from [Taostats](https://taostats.io)
2. Update `src/adapters/bittensor.ts` with your API key:
   ```typescript
   private apiKey = 'your-api-key-here';
   ```

#### Osmosis (Cosmos LCD REST API)

No API key required. Uses public Cosmos LCD REST endpoints with automatic failover:
- `https://lcd.osmosis.zone`
- `https://rest.osmosis.goldenratiostaking.net`
- `https://osmosis-api.polkachu.com`

#### Variational (Arbiscan API)

Uses Arbiscan API free tier (5 calls/sec). For higher rate limits:
1. Get an API key from [Arbiscan](https://arbiscan.io/apis)
2. Update `src/adapters/variational.ts` with your API key

#### Extended (Voyager/StarkScan API)

No API key required. Uses public Starknet explorer APIs:
- Primary: Voyager API
- Fallback: StarkScan API

## Architecture

The project uses a chain adapter pattern for easy extensibility:

```
src/
├── adapters/           # Chain-specific adapters
│   ├── base.ts         # Base adapter class
│   ├── polkadot.ts     # Polkadot (Subscan)
│   ├── bittensor.ts    # Bittensor (Taostats)
│   ├── ronin.ts        # Ronin (Explorer API)
│   ├── osmosis.ts      # Osmosis (Cosmos LCD REST)
│   ├── variational.ts  # Variational (Arbiscan)
│   ├── extended.ts     # Extended (Voyager/StarkScan)
│   └── index.ts        # Adapter registry
├── types/              # TypeScript types
│   └── index.ts        # Normalized transaction model
├── utils/              # Utility functions
│   ├── csv.ts          # Awaken CSV export
│   └── filters.ts      # Transaction filtering
├── hooks/              # React hooks
│   └── useTransactions.ts
└── App.tsx             # Main application
```

## Adding a New Chain

See [CHAIN_INTEGRATION_GUIDE.md](./CHAIN_INTEGRATION_GUIDE.md) for detailed instructions on adding support for new blockchains.

### Quick Overview

1. Create a new adapter in `src/adapters/`
2. Implement the `ChainAdapter` interface
3. Register the adapter in `src/adapters/index.ts`

```typescript
import { BaseChainAdapter } from './base';
import { ChainInfo, FetchOptions, FetchResult } from '../types';

export class MyChainAdapter extends BaseChainAdapter {
  chainInfo: ChainInfo = {
    id: 'mychain',
    name: 'My Chain',
    symbol: 'MYC',
    logo: 'https://example.com/logo.png',
    explorerUrl: 'https://explorer.mychain.com',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    addressPlaceholder: '0x...',
  };

  async fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult> {
    // Implement transaction fetching logic
  }

  getExplorerUrl(hash: string): string {
    return `${this.chainInfo.explorerUrl}/tx/${hash}`;
  }
}
```

## Awaken CSV Format

The export follows Awaken tax software format:

| Column | Description |
|--------|-------------|
| Date | Transaction timestamp (ISO 8601) |
| Asset | Token symbol (e.g., DOT, TAO, RON) |
| Amount | Transaction amount |
| Fee | Transaction fee |
| P&L | Profit/Loss (empty by default) |
| Payment Token | Fee token symbol |
| ID | Unique transaction identifier |
| Notes | User notes |
| Tag | Transaction tag |
| Transaction Hash | Blockchain transaction hash |

## Test Addresses

Use these addresses to test the application:

- **Polkadot**: `16ZL8yLyXv3V3L3z9ofR1ovFLziyXaN1DPq4yffMAZ9czzBD`
- **Bittensor**: `5FFApaS75bv5pJHfAp2FVLBj9ZaXuFDjEypsaBNc1wCfe52v`
- **Ronin**: `0xa8754b9fa15fc18bb59458815510e40a12cd2014`

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

1. Follow the existing code style
2. Add TypeScript types for all new code
3. Test your changes with real wallet addresses
4. Update documentation as needed

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Roadmap

- [x] Osmosis chain support (Cosmos SDK)
- [x] Variational protocol support (Arbitrum)
- [x] Extended Exchange support (Starknet)
- [ ] User-configurable API keys via UI
- [ ] Local storage for saved addresses
- [ ] Transaction tagging and notes
- [ ] More export formats (Koinly, CoinTracker)

## Acknowledgments

- [Subscan](https://subscan.io) for Polkadot API
- [Taostats](https://taostats.io) for Bittensor API
- [Ronin](https://roninchain.com) for Ronin Explorer API
- [Numia](https://numia.xyz) for Cosmos chain APIs
- [Vidulum](https://github.com/corey-code/vidulum-app) for Cosmos SDK patterns inspiration
