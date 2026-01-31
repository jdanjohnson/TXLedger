import { ChainAdapter } from '../types';
import { PolkadotAdapter } from './polkadot';
import { BittensorAdapter } from './bittensor';
import { OsmosisAdapter } from './osmosis';
import { RoninAdapter } from './ronin';

export const adapters: Record<string, ChainAdapter> = {
  polkadot: new PolkadotAdapter(),
  bittensor: new BittensorAdapter(),
  osmosis: new OsmosisAdapter(),
  ronin: new RoninAdapter(),
};

export const getAdapter = (chainId: string): ChainAdapter | undefined => {
  return adapters[chainId];
};

export const getSupportedChains = () => {
  return Object.values(adapters).map(adapter => adapter.chainInfo);
};

export { PolkadotAdapter, BittensorAdapter, OsmosisAdapter, RoninAdapter };
