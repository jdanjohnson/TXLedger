import { ChainAdapter } from '../types';
import { generateEvmAdapters } from './evm-factory';
import { generateCosmosAdapters } from './cosmos-factory';
import { generateSubstrateAdapters } from './substrate-factory';
import { BittensorAdapter } from './bittensor';
import { RoninAdapter } from './ronin';
import { VariationalAdapter } from './variational';
import { ExtendedAdapter } from './extended';
import { HyperliquidAdapter } from './hyperliquid';
import { DydxAdapter } from './dydx';
import { GmxAdapter } from './gmx';

const evmAdapters = generateEvmAdapters();
const cosmosAdapters = generateCosmosAdapters();
const substrateAdapters = generateSubstrateAdapters();

export const adapters: Record<string, ChainAdapter> = {
  ...evmAdapters,
  ...cosmosAdapters,
  ...substrateAdapters,
  bittensor: new BittensorAdapter(),
  ronin: new RoninAdapter(),
  variational: new VariationalAdapter(),
  extended: new ExtendedAdapter(),
  hyperliquid: new HyperliquidAdapter(),
  dydx: new DydxAdapter(),
  gmx: new GmxAdapter(),
};

export const getAdapter = (chainId: string): ChainAdapter | undefined => {
  return adapters[chainId];
};

export const getSupportedChains = () => {
  return Object.values(adapters).map(adapter => adapter.chainInfo);
};

export { 
  BittensorAdapter, 
  RoninAdapter, 
  VariationalAdapter, 
  ExtendedAdapter,
  HyperliquidAdapter,
  DydxAdapter,
  GmxAdapter,
  generateEvmAdapters,
  generateCosmosAdapters,
  generateSubstrateAdapters,
};
