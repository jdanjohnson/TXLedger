import { ChainAdapter, ChainInfo, FetchOptions, FetchResult, NormalizedTransaction, PerpsTag } from '../types';

export interface PerpsChainConfig {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  explorerUrl: string;
  addressRegex: RegExp;
  addressPlaceholder: string;
  settlementToken: string;
}

export function truncateDecimals(n: number, decimals: number = 8): number {
  const factor = Math.pow(10, decimals);
  return Math.trunc(n * factor) / factor;
}

export function formatDateUTC(timestampMs: number): string {
  const d = new Date(timestampMs);
  return d.toISOString();
}

export function formatDateForAwaken(timestampMs: number): string {
  const d = new Date(timestampMs);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

export interface PerpsValidationError {
  field: string;
  message: string;
  value: string;
}

const VALID_PERPS_TAGS = new Set<PerpsTag>(['open_position', 'close_position', 'funding_payment']);

export function validatePerpsTransaction(tx: NormalizedTransaction): PerpsValidationError[] {
  const errors: PerpsValidationError[] = [];

  if (!tx.asset || tx.asset.trim() === '') {
    errors.push({ field: 'asset', message: 'Asset is required', value: tx.asset });
  }

  if (!tx.hash || tx.hash.trim() === '') {
    errors.push({ field: 'hash', message: 'Transaction hash is required', value: tx.hash });
  }

  const tag = tx.tag as PerpsTag;
  if (tag && !VALID_PERPS_TAGS.has(tag)) {
    errors.push({
      field: 'tag',
      message: `Invalid tag. Must be one of: ${[...VALID_PERPS_TAGS].join(', ')}`,
      value: tx.tag,
    });
  }

  if ((tag === 'close_position' || tag === 'funding_payment') && !tx.paymentToken) {
    errors.push({
      field: 'paymentToken',
      message: `Payment token is required for ${tag}`,
      value: tx.paymentToken || '',
    });
  }

  if (tag === 'open_position' && tx.pnl && parseFloat(tx.pnl) !== 0) {
    errors.push({
      field: 'pnl',
      message: 'P&L must be 0 for open_position events',
      value: tx.pnl,
    });
  }

  return errors;
}

export function validatePerpsTransactions(transactions: NormalizedTransaction[]): PerpsValidationError[] {
  const errors: PerpsValidationError[] = [];
  const seenHashes = new Map<string, number>();

  for (let i = 0; i < transactions.length; i++) {
    const txErrors = validatePerpsTransaction(transactions[i]);
    errors.push(...txErrors.map(e => ({ ...e, message: `Row ${i}: ${e.message}` })));

    const hash = transactions[i].hash;
    if (seenHashes.has(hash)) {
      errors.push({
        field: 'hash',
        message: `Row ${i}: Duplicate transaction hash (first seen at row ${seenHashes.get(hash)})`,
        value: hash,
      });
    } else {
      seenHashes.set(hash, i);
    }
  }

  return errors;
}

export abstract class BasePerpsAdapter implements ChainAdapter {
  abstract chainInfo: ChainInfo;
  protected config: PerpsChainConfig;

  constructor(config: PerpsChainConfig) {
    this.config = config;
  }

  validateAddress(address: string): boolean {
    return this.chainInfo.addressRegex.test(address);
  }

  abstract fetchTransactions(address: string, options?: FetchOptions): Promise<FetchResult>;

  getExplorerUrl(hash: string): string {
    return `${this.chainInfo.explorerUrl}/tx/${hash}`;
  }

  protected createTransaction(params: {
    hash: string;
    timestampMs: number;
    asset: string;
    amount: number;
    fee: number;
    pnl: number;
    tag: PerpsTag;
    notes: string;
    address: string;
    block?: string;
  }): NormalizedTransaction {
    const { hash, timestampMs, asset, amount, fee, pnl, tag, notes, address, block } = params;
    
    const direction = tag === 'open_position' ? 'out' : 
                      tag === 'close_position' ? (pnl >= 0 ? 'in' : 'out') :
                      tag === 'funding_payment' ? (pnl >= 0 ? 'in' : 'out') : 'unknown';

    return {
      chainId: this.chainInfo.id,
      address,
      datetimeUtc: new Date(timestampMs).toISOString(),
      hash,
      type: tag.replace('_', ' '),
      direction,
      counterparty: this.chainInfo.name,
      asset,
      amount: truncateDecimals(Math.abs(amount)).toString(),
      fee: truncateDecimals(Math.abs(fee)).toString(),
      feeAsset: this.config.settlementToken,
      status: 'success',
      block: block || '',
      explorerUrl: this.getExplorerUrl(hash),
      notes,
      tag,
      pnl: truncateDecimals(pnl).toString(),
      paymentToken: (tag === 'close_position' || tag === 'funding_payment') ? this.config.settlementToken : undefined,
    };
  }
}
