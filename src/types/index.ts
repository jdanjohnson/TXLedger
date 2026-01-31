export interface ChainInfo {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  explorerUrl: string;
  addressRegex: RegExp;
  addressPlaceholder: string;
}

export interface NormalizedTransaction {
  chainId: string;
  address: string;
  datetimeUtc: string;
  hash: string;
  type: string;
  direction: 'in' | 'out' | 'self' | 'unknown';
  counterparty: string;
  asset: string;
  amount: string;
  fee: string;
  feeAsset: string;
  status: 'success' | 'failed' | 'pending';
  block: string;
  explorerUrl: string;
  notes: string;
  tag: string;
  pnl: string;
  rawDetails?: Record<string, unknown>;
}

export interface FetchOptions {
  cursor?: string;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  direction?: 'in' | 'out' | 'all';
  assetFilter?: string;
}

export interface FetchResult {
  transactions: NormalizedTransaction[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}

export interface ChainAdapter {
  chainInfo: ChainInfo;
  validateAddress(address: string): boolean;
  fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult>;
  getExplorerUrl(hash: string): string;
}

export interface FilterState {
  dateRange: { start: Date | null; end: Date | null };
  direction: 'all' | 'in' | 'out';
  type: string;
  asset: string;
  search: string;
}

export interface AwakenCsvRow {
  Date: string;
  Asset: string;
  Amount: string;
  Fee: string;
  'P&L': string;
  'Payment Token': string;
  ID: string;
  Notes: string;
  Tag: string;
  'Transaction Hash': string;
}
