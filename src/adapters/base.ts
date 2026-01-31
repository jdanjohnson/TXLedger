import { ChainAdapter, ChainInfo, FetchOptions, FetchResult } from '../types';

export abstract class BaseChainAdapter implements ChainAdapter {
  abstract chainInfo: ChainInfo;

  validateAddress(address: string): boolean {
    return this.chainInfo.addressRegex.test(address);
  }

  abstract fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult>;

  getExplorerUrl(hash: string): string {
    return `${this.chainInfo.explorerUrl}/tx/${hash}`;
  }
}
