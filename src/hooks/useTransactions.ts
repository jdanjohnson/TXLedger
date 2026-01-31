import { useState, useCallback } from 'react';
import { NormalizedTransaction, FetchResult, FilterState } from '../types';
import { getAdapter } from '../adapters';
import { applyFilters, sortTransactions } from '../utils/filters';

interface UseTransactionsReturn {
  transactions: NormalizedTransaction[];
  filteredTransactions: NormalizedTransaction[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number | undefined;
  fetchTransactions: (chainId: string, address: string) => Promise<void>;
  loadMore: () => Promise<void>;
  setFilters: (filters: FilterState) => void;
  setSortBy: (sortBy: string) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  filters: FilterState;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  reset: () => void;
}

const initialFilters: FilterState = {
  dateRange: { start: null, end: null },
  direction: 'all',
  type: '',
  asset: '',
  search: '',
};

export const useTransactions = (): UseTransactionsReturn => {
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [currentChainId, setCurrentChainId] = useState<string>('');
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchTransactions = useCallback(async (chainId: string, address: string) => {
    const adapter = getAdapter(chainId);
    if (!adapter) {
      setError(`Unsupported chain: ${chainId}`);
      return;
    }

    if (!adapter.validateAddress(address)) {
      setError(`Invalid address format for ${adapter.chainInfo.name}`);
      return;
    }

    setLoading(true);
    setError(null);
    setTransactions([]);
    setCursor(undefined);
    setCurrentChainId(chainId);
    setCurrentAddress(address);

    try {
      const result: FetchResult = await adapter.fetchTransactions(address, { limit: 100 });
      setTransactions(result.transactions);
      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
      setTotalCount(result.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !cursor) return;

    const adapter = getAdapter(currentChainId);
    if (!adapter) return;

    setLoading(true);

    try {
      const result: FetchResult = await adapter.fetchTransactions(currentAddress, {
        cursor,
        limit: 100,
      });
      setTransactions(prev => [...prev, ...result.transactions]);
      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more transactions');
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, cursor, currentChainId, currentAddress]);

  const reset = useCallback(() => {
    setTransactions([]);
    setLoading(false);
    setError(null);
    setHasMore(false);
    setTotalCount(undefined);
    setCursor(undefined);
    setCurrentChainId('');
    setCurrentAddress('');
    setFilters(initialFilters);
  }, []);

  const filteredTransactions = sortTransactions(
    applyFilters(transactions, filters),
    sortBy,
    sortOrder
  );

  return {
    transactions,
    filteredTransactions,
    loading,
    error,
    hasMore,
    totalCount,
    fetchTransactions,
    loadMore,
    setFilters,
    setSortBy,
    setSortOrder,
    filters,
    sortBy,
    sortOrder,
    reset,
  };
};
