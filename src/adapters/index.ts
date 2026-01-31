import { ChainAdapter } from '../types';
import { PolkadotAdapter } from './polkadot';
import { BittensorAdapter } from './bittensor';
import { OsmosisAdapter } from './osmosis';
import { RoninAdapter } from './ronin';
import { VariationalAdapter } from './variational';
import { ExtendedAdapter } from './extended';
import { HyperliquidAdapter } from './hyperliquid';
import { DydxAdapter } from './dydx';
import { GmxAdapter } from './gmx';

export const adapters: Record<string, ChainAdapter> = {
  polkadot: new PolkadotAdapter(),
  bittensor: new BittensorAdapter(),
  osmosis: new OsmosisAdapter(),
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

export { PolkadotAdapter, BittensorAdapter, OsmosisAdapter, RoninAdapter, VariationalAdapter, ExtendedAdapter };
export { HyperliquidAdapter, DydxAdapter, GmxAdapter };
