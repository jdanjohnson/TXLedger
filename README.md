# TXLedger

A multi-chain blockchain wallet transaction explorer that fetches, displays, and exports wallet transactions in Awaken CSV format for tax reporting. Built for [AWAKE Tax](https://awaketax.com).

> **Live Demo**: [txledger.jadan.dev](https://txledger.jadan.dev) - Full support for all 25+ chains including Cosmos ecosystem. The demo deployment includes a built-in CORS proxy, so all chains work out of the box.
>
> **Self-Hosted Note**: If you're deploying your own instance, you'll need to set up a CORS proxy for Cosmos chains. See [Vercel Deployment](#vercel-deployment-recommended) below for the easiest setup.

## Features

- **Multi-Chain Support**: Query transactions across multiple blockchains from a single interface
- **Transaction Table**: View transactions in a clean, sortable, and filterable table
- **Search & Filter**: Search by hash, address, or notes; filter by direction, type, and asset
- **Awaken CSV Export**: Export transactions in Awaken tax software format
- **Transaction Details**: Click any row to view full transaction details with block explorer links
- **Pagination**: Handle wallets with large transaction histories

## Supported Chains

TXLedger supports **25+ blockchains** across multiple ecosystems using a config-driven adapter factory architecture.

### EVM Chains

| Chain | Status | API | Notes |
|-------|--------|-----|-------|
| Ethereum | Active | Blockscout API | Full support |
| Arbitrum | Active | Blockscout API | Full support |
| Optimism | Active | Blockscout API | Full support |
| Base | Active | Blockscout API | Full support |
| Polygon PoS | Active | Blockscout API | Full support |
| zkSync Era | Active | Blockscout API | Full support |
| Immutable zkEVM | Active | Blockscout API | Full support |
| Oasys | Active | Blockscout API | Full support |
| Beam | Active | Etherscan API | Full support |
| Moonbeam | Active | Blockscout API | Full support |

### Substrate Chains

| Chain | Status | API | Notes |
|-------|--------|-----|-------|
| Polkadot | Active | Subscan API | Full support |
| Kusama | Active | Subscan API | Full support |
| Astar | Active | Subscan API | Full support |
| Acala | Active | Subscan API | Full support |

### Cosmos Chains

| Chain | Status | API | Notes |
|-------|--------|-----|-------|
| Osmosis | Active | Cosmos LCD REST | Full support on demo |
| Cosmos Hub | Active | Cosmos LCD REST | Full support on demo |
| Celestia | Active | Cosmos LCD REST | Full support on demo |
| dYdX Chain | Active | Cosmos LCD REST | Full support on demo |
| Sei | Active | Cosmos LCD REST | Full support on demo |
| Injective | Active | Cosmos LCD REST | Full support on demo |
| Neutron | Active | Cosmos LCD REST | Full support on demo |
| Noble | Active | Cosmos LCD REST | Full support on demo |

> **Self-hosted deployments**: Cosmos chains require a CORS proxy. The demo at [txledger.jadan.dev](https://txledger.jadan.dev) includes this automatically. For your own deployment, see [Vercel Deployment](#vercel-deployment-recommended).

### Other Chains

| Chain | Status | API | Notes |
|-------|--------|-----|-------|
| Bittensor | Active | Taostats API | Requires API Key |
| Ronin | Active | Ronin Explorer API | Full support |
| Variational | Active | Blockscout API | Arbitrum-based |
| Extended | Limited | Voyager/StarkScan API | Requires CORS proxy |
| Hyperliquid | Active | Hyperliquid API | Perps/derivatives |
| dYdX (Perps) | Active | dYdX API | Perps/derivatives |
| GMX | Active | GMX API | Perps/derivatives |

*Cosmos chains and Extended require a backend proxy for browser requests. See [CORS Limitations](#cors-limitations) below.

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

#### Variational (Blockscout API)

Uses Blockscout API for Arbitrum (free, no API key required). The adapter filters transactions to only show interactions with Variational protocol contracts:
- Core OLP Vault: `0x74bbbb0e7f0bad6938509dd4b556a39a4db1f2cd`
- Settlement Pool Factory: `0x0F820B9afC270d658a9fD7D16B1Bdc45b70f074C`

#### Extended (Voyager/StarkScan API)

**Note: Currently limited due to CORS restrictions.** See [CORS Limitations](#cors-limitations) for details.

Uses public Starknet explorer APIs:
- Primary: Voyager API
- Fallback: StarkScan API

## CORS Limitations

Some blockchain APIs don't support CORS (Cross-Origin Resource Sharing), which prevents browser-based applications from making direct requests. This affects:

### Affected Chains

| Chain | API | Issue | Demo Status |
|-------|-----|-------|-------------|
| All Cosmos chains | Cosmos LCD REST | No CORS headers on public LCD endpoints | Working on demo |
| Extended | Voyager/StarkScan | No CORS headers on Starknet explorer APIs | Requires proxy |

### How to Enable Full Support

The demo at [txledger.jadan.dev](https://txledger.jadan.dev) includes a built-in CORS proxy, so all chains work automatically. For self-hosted deployments, you need to set up a backend proxy.

## Vercel Deployment (Recommended)

This is the easiest way to deploy TXLedger with full Cosmos chain support. The repository includes a pre-configured Vercel serverless function that handles CORS proxying automatically.

### Step 1: Fork and Deploy

1. Fork this repository to your GitHub account
2. Go to [vercel.com](https://vercel.com) and import your forked repository
3. Deploy with default settings - no configuration needed!

The app will automatically detect it's running on Vercel and use the built-in proxy for Cosmos chains.

### Step 2: Custom Domain (Optional)

1. In Vercel dashboard, go to your project settings
2. Add your custom domain under "Domains"
3. The proxy will work automatically on your custom domain

### How It Works

The repository includes two files that enable the CORS proxy:

**`api/proxy.ts`** - Vercel serverless function:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const response = await fetch(decodeURIComponent(url));
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed' });
  }
}
```

**`vercel.json`** - Route configuration:
```json
{
  "rewrites": [{ "source": "/api/:path*", "destination": "/api/:path*" }],
  "headers": [{
    "source": "/api/(.*)",
    "headers": [
      { "key": "Access-Control-Allow-Origin", "value": "*" },
      { "key": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" }
    ]
  }]
}
```

The `cosmos-factory.ts` adapter automatically detects when running on Vercel or a custom domain and routes requests through `/api/proxy` instead of the fallback public proxy.

## Alternative Deployment Options

If you're not using Vercel, here are other ways to set up a CORS proxy:

### Cloudflare Workers

Deploy a simple proxy worker:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  const response = await fetch(targetUrl);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  return newResponse;
}
```

### Self-hosted Proxy

Run a simple Express proxy server:

```javascript
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

app.get('/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy failed' });
  }
});

app.listen(3001);
```

### Updating Adapters to Use Proxy

Once you have a proxy set up, update the adapter files:

**For Osmosis (`src/adapters/osmosis.ts`):**
```typescript
// Change from:
const response = await fetch(url);

// To:
const PROXY_URL = '/api/proxy?url=';
const response = await fetch(PROXY_URL + encodeURIComponent(url));
```

**For Extended (`src/adapters/extended.ts`):**
```typescript
// Same pattern - prepend your proxy URL to API requests
const PROXY_URL = '/api/proxy?url=';
const response = await fetch(PROXY_URL + encodeURIComponent(url));
```

## Architecture

The project uses a **config-driven adapter factory pattern** for easy extensibility. Instead of writing a new adapter class for each chain, chains are defined as configuration objects and adapters are generated automatically.

```
src/
├── adapters/           # Chain adapters
│   ├── base.ts         # Base adapter class
│   ├── evm-factory.ts  # EVM chain factory (Blockscout/Etherscan APIs)
│   ├── cosmos-factory.ts    # Cosmos chain factory (LCD REST API)
│   ├── substrate-factory.ts # Substrate chain factory (Subscan API)
│   ├── bittensor.ts    # Bittensor (Taostats)
│   ├── ronin.ts        # Ronin (Explorer API)
│   ├── variational.ts  # Variational (Arbiscan)
│   ├── extended.ts     # Extended (Voyager/StarkScan)
│   ├── hyperliquid.ts  # Hyperliquid (Perps)
│   ├── dydx.ts         # dYdX (Perps)
│   ├── gmx.ts          # GMX (Perps)
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

### Factory Pattern

The factory pattern makes adding new chains trivial. For example, to add a new EVM chain:

```typescript
// In evm-factory.ts, just add a config object:
{
  id: 'newchain',
  name: 'New Chain',
  symbol: 'NEW',
  logo: 'https://example.com/logo.png',
  explorerUrl: 'https://explorer.newchain.com',
  addressPlaceholder: '0x...',
  apiBase: 'https://newchain.blockscout.com/api/v2',
  apiType: 'blockscout',
}
```

The factory automatically generates a fully functional adapter with transaction fetching, normalization, and explorer URL generation.

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
| Date | Transaction timestamp (MM/DD/YYYY HH:MM:SS UTC) |
| Asset | Token symbol (e.g., DOT, TAO, RON, ETH-PERP) |
| Amount | Transaction amount or position size |
| Fee | Transaction fee |
| P&L | Profit/Loss (see perps section below) |
| Payment Token | Settlement token for P&L and fees |
| ID | Unique transaction identifier (first 16 chars of hash) |
| Notes | Transaction type and direction |
| Tag | Transaction classification tag |
| Transaction Hash | Full blockchain transaction hash |

### CSV Differences: Regular Chains vs Perps

The CSV export format is the same for all chains, but the data differs significantly between regular blockchain transactions and perpetual/derivatives trading:

#### Regular Chains (EVM, Substrate, Cosmos)

For standard blockchain transactions (transfers, swaps, staking, etc.):

| Field | Typical Value | Example |
|-------|---------------|---------|
| Asset | Native token or transferred token | `ETH`, `DOT`, `OSMO` |
| Amount | Transfer amount | `1.5` |
| P&L | Always `0` | `0` |
| Payment Token | Same as fee asset | `ETH` |
| Tag | Empty | `` |
| Notes | `{type} - {direction}` | `transfer - out` |

#### Perps Chains (Hyperliquid, dYdX, GMX)

For perpetual futures and derivatives trading:

| Field | Typical Value | Example |
|-------|---------------|---------|
| Asset | Market symbol with `-PERP` suffix | `ETH-PERP`, `BTC-PERP` |
| Amount | Position size in contracts/units | `0.5` |
| P&L | Realized profit/loss in settlement token | `-125.50` or `340.25` |
| Payment Token | Settlement token (USDC, USDT, etc.) | `USDC` |
| Tag | Position action type | `open_position`, `close_position`, `funding_payment` |
| Notes | Detailed trade description | `Long ETH-PERP 0.5 @ 2450.00` |

#### Perps Tag Values

| Tag | Description | P&L Behavior |
|-----|-------------|--------------|
| `open_position` | Opening a new long or short position | P&L = 0 |
| `close_position` | Closing an existing position | P&L = realized gain/loss |
| `funding_payment` | Periodic funding rate payment | P&L = funding received/paid |

#### Example CSV Rows

**Regular chain (Ethereum transfer):**
```csv
Date,Asset,Amount,Fee,P&L,Payment Token,ID,Notes,Tag,Transaction Hash
01/15/2026 14:30:00,ETH,1.5,0.002,0,ETH,0x1234567890ab,transfer - out,,0x1234567890abcdef...
```

**Perps chain (Hyperliquid close position):**
```csv
Date,Asset,Amount,Fee,P&L,Payment Token,ID,Notes,Tag,Transaction Hash
01/15/2026 14:30:00,ETH-PERP,0.5,1.25,340.50,USDC,0xabcd12345678,close position - in,close_position,0xabcd12345678efgh...
```

This distinction is important for tax reporting: regular transactions typically represent cost basis events, while perps P&L represents realized capital gains/losses that may be taxed differently.

## Test Addresses

Use these addresses to test the application:

### EVM Chains
- **Ethereum**: `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` (vitalik.eth)
- **Arbitrum**: `0x489ee077994B6658eAfA855C308275EAd8097C4A`
- **Base**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Polygon**: `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`

### Substrate Chains
- **Polkadot**: `16ZL8yLyXv3V3L3z9ofR1ovFLziyXaN1DPq4yffMAZ9czzBD`
- **Kusama**: `HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F`

### Cosmos Chains (requires CORS proxy)
- **Osmosis**: `osmo1clpqr4nrk4khgkxj78fcwwh6dl3uw4ep88n0y4`
- **Cosmos Hub**: `cosmos1clpqr4nrk4khgkxj78fcwwh6dl3uw4epasmvnj`

### Other Chains
- **Bittensor**: `5FFApaS75bv5pJHfAp2FVLBj9ZaXuFDjEypsaBNc1wCfe52v`
- **Ronin**: `0xa8754b9fa15fc18bb59458815510e40a12cd2014`
- **Variational**: `0x74bbbb0e7f0bad6938509dd4b556a39a4db1f2cd` (OLP Vault contract)
- **Extended**: `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` (requires proxy)

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

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](./LICENSE) file for details.

TXLedger is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

## Roadmap

- [x] Osmosis chain support (Cosmos SDK)
- [x] Variational protocol support (Arbitrum)
- [x] Extended Exchange support (Starknet)
- [x] Multi-chain support (25+ chains via config-driven factories)
- [x] EVM chain support (Ethereum, Arbitrum, Optimism, Base, Polygon, zkSync, etc.)
- [x] Substrate chain support (Polkadot, Kusama, Astar, Acala)
- [x] Cosmos chain support (Osmosis, Cosmos Hub, Celestia, dYdX, Sei, Injective, etc.)
- [x] Derivatives/Perps support (Hyperliquid, dYdX, GMX)
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
