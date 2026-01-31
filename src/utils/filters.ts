import { NormalizedTransaction, FilterState } from '../types';

export const applyFilters = (
  transactions: NormalizedTransaction[],
  filters: FilterState
): NormalizedTransaction[] => {
  return transactions.filter(tx => {
    if (filters.dateRange.start) {
      const txDate = new Date(tx.datetimeUtc);
      if (txDate < filters.dateRange.start) return false;
    }

    if (filters.dateRange.end) {
      const txDate = new Date(tx.datetimeUtc);
      if (txDate > filters.dateRange.end) return false;
    }

    if (filters.direction !== 'all' && tx.direction !== filters.direction) {
      return false;
    }

    if (filters.type && tx.type !== filters.type) {
      return false;
    }

    if (filters.asset && tx.asset.toLowerCase() !== filters.asset.toLowerCase()) {
      return false;
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesHash = tx.hash.toLowerCase().includes(searchLower);
      const matchesCounterparty = tx.counterparty.toLowerCase().includes(searchLower);
      const matchesNotes = tx.notes.toLowerCase().includes(searchLower);
      const matchesAsset = tx.asset.toLowerCase().includes(searchLower);
      if (!matchesHash && !matchesCounterparty && !matchesNotes && !matchesAsset) {
        return false;
      }
    }

    return true;
  });
};

export const sortTransactions = (
  transactions: NormalizedTransaction[],
  sortBy: string,
  sortOrder: 'asc' | 'desc'
): NormalizedTransaction[] => {
  return [...transactions].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'date':
        comparison = new Date(a.datetimeUtc).getTime() - new Date(b.datetimeUtc).getTime();
        break;
      case 'amount':
        comparison = parseFloat(a.amount) - parseFloat(b.amount);
        break;
      case 'fee':
        comparison = parseFloat(a.fee) - parseFloat(b.fee);
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'asset':
        comparison = a.asset.localeCompare(b.asset);
        break;
      default:
        comparison = 0;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });
};

export const getUniqueTypes = (transactions: NormalizedTransaction[]): string[] => {
  return [...new Set(transactions.map(tx => tx.type))].sort();
};

export const getUniqueAssets = (transactions: NormalizedTransaction[]): string[] => {
  return [...new Set(transactions.map(tx => tx.asset))].sort();
};
