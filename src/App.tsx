import { useState, useMemo } from 'react';
import { Search, Download, ExternalLink, ChevronDown, ChevronUp, X, Loader2, ArrowUpDown, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getSupportedChains } from './adapters';
import { useTransactions } from './hooks/useTransactions';
import { getUniqueTypes, getUniqueAssets } from './utils/filters';
import { generateAwakenCsv, downloadCsv } from './utils/csv';
import { NormalizedTransaction } from './types';
import './App.css';

function App() {
  const chains = getSupportedChains();
  const [selectedChain, setSelectedChain] = useState(chains[0]?.id || '');
  const [address, setAddress] = useState('');
  const [selectedTx, setSelectedTx] = useState<NormalizedTransaction | null>(null);

  const {
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
  } = useTransactions();

  const selectedChainInfo = useMemo(() => {
    return chains.find(c => c.id === selectedChain);
  }, [chains, selectedChain]);

  const uniqueTypes = useMemo(() => getUniqueTypes(transactions), [transactions]);
  const uniqueAssets = useMemo(() => getUniqueAssets(transactions), [transactions]);

  const handleFetch = () => {
    if (!address.trim()) return;
    fetchTransactions(selectedChain, address.trim());
  };

  const handleExportCsv = () => {
    const csv = generateAwakenCsv(filteredTransactions);
    const filename = `${selectedChain}_${address.slice(0, 8)}_transactions_awaken.csv`;
    downloadCsv(csv, filename);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const shortenHash = (hash: string) => {
    if (!hash) return '';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const shortenAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const getDirectionBadge = (direction: string) => {
    const colors: Record<string, string> = {
      in: 'bg-green-100 text-green-800',
      out: 'bg-red-100 text-red-800',
      self: 'bg-blue-100 text-blue-800',
      unknown: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[direction] || colors.unknown}`}>
        {direction.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortOrder === 'asc' ? 
      <ChevronUp className="h-4 w-4 ml-1" /> : 
      <ChevronDown className="h-4 w-4 ml-1" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Wallet Transaction Explorer</h1>
              <p className="text-sm text-gray-500">Fetch, view, and export wallet transactions in Awaken CSV format</p>
            </div>
            <Select value={selectedChain} onValueChange={setSelectedChain}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select chain" />
              </SelectTrigger>
              <SelectContent>
                {[...chains].sort((a, b) => (a.limited ? 1 : 0) - (b.limited ? 1 : 0)).map(chain => (
                  <SelectItem key={chain.id} value={chain.id}>
                    <div className="flex items-center gap-2">
                      <img src={chain.logo} alt={chain.name} className="w-5 h-5 rounded-full" />
                      {chain.name}
                      {chain.limited && (
                        <span className="ml-1 flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded" title="Limited - requires backend proxy for full functionality">
                          <Hourglass className="w-3 h-3" />
                          <span className="hidden sm:inline">Coming Soon</span>
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Enter Wallet Address</CardTitle>
            <CardDescription>
              Paste a {selectedChainInfo?.name || 'wallet'} address to fetch all transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder={selectedChainInfo?.addressPlaceholder || 'Enter wallet address...'}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                className="flex-1 font-mono text-sm"
              />
              <Button onClick={handleFetch} disabled={loading || !address.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  'Fetch Transactions'
                )}
              </Button>
            </div>
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {transactions.length > 0 && (
          <>
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-64">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search by hash, address, notes..."
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Select
                    value={filters.direction}
                    onValueChange={(value) => setFilters({ ...filters, direction: value as 'all' | 'in' | 'out' })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="in">Incoming</SelectItem>
                      <SelectItem value="out">Outgoing</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.type || 'all'}
                    onValueChange={(value) => setFilters({ ...filters, type: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {uniqueTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filters.asset || 'all'}
                    onValueChange={(value) => setFilters({ ...filters, asset: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Asset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assets</SelectItem>
                      {uniqueAssets.map(asset => (
                        <SelectItem key={asset} value={asset}>{asset}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button variant="outline" onClick={handleExportCsv} className="ml-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Download Awaken CSV
                  </Button>
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
                  <span>
                    <strong>{filteredTransactions.length}</strong> of {transactions.length} transactions
                    {totalCount && totalCount > transactions.length && ` (${totalCount} total on chain)`}
                  </span>
                  {transactions.length > 0 && (
                    <span>
                      Date range: {formatDate(transactions[transactions.length - 1].datetimeUtc)} - {formatDate(transactions[0].datetimeUtc)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('date')}
                      >
                        <div className="flex items-center">
                          Date/Time
                          <SortIcon column="date" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('type')}
                      >
                        <div className="flex items-center">
                          Type
                          <SortIcon column="type" />
                        </div>
                      </TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Counterparty</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('asset')}
                      >
                        <div className="flex items-center">
                          Asset
                          <SortIcon column="asset" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 text-right"
                        onClick={() => handleSort('amount')}
                      >
                        <div className="flex items-center justify-end">
                          Amount
                          <SortIcon column="amount" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-50 text-right"
                        onClick={() => handleSort('fee')}
                      >
                        <div className="flex items-center justify-end">
                          Fee
                          <SortIcon column="fee" />
                        </div>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => (
                      <TableRow 
                        key={tx.hash} 
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setSelectedTx(tx)}
                      >
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(tx.datetimeUtc)}
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                            {tx.type}
                          </span>
                        </TableCell>
                        <TableCell>{getDirectionBadge(tx.direction)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {shortenAddress(tx.counterparty)}
                        </TableCell>
                        <TableCell className="font-medium">{tx.asset}</TableCell>
                        <TableCell className="text-right font-mono">
                          {parseFloat(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-gray-500 text-sm">
                          {parseFloat(tx.fee).toLocaleString(undefined, { maximumFractionDigits: 8 })} {tx.feeAsset}
                        </TableCell>
                        <TableCell>{getStatusBadge(tx.status)}</TableCell>
                        <TableCell>
                          <a
                            href={tx.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-mono text-xs"
                          >
                            {shortenHash(tx.hash)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {hasMore && (
                <div className="p-4 border-t text-center">
                  <Button variant="outline" onClick={loadMore} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More Transactions'
                    )}
                  </Button>
                </div>
              )}
            </Card>
          </>
        )}

        {!loading && transactions.length === 0 && !error && (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="text-gray-400 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions yet</h3>
              <p className="text-gray-500">
                Enter a wallet address above to fetch and view transactions
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {selectedTx && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Transaction Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTx(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Transaction Hash</label>
                <div className="mt-1 font-mono text-sm break-all">{selectedTx.hash}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Date & Time (UTC)</label>
                <div className="mt-1">{new Date(selectedTx.datetimeUtc).toUTCString()}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Type</label>
                  <div className="mt-1">{selectedTx.type}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Direction</label>
                  <div className="mt-1">{getDirectionBadge(selectedTx.direction)}</div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Counterparty</label>
                <div className="mt-1 font-mono text-sm break-all">{selectedTx.counterparty}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Asset</label>
                  <div className="mt-1 font-medium">{selectedTx.asset}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount</label>
                  <div className="mt-1 font-mono">{selectedTx.amount}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Fee</label>
                  <div className="mt-1 font-mono">{selectedTx.fee} {selectedTx.feeAsset}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedTx.status)}</div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Block</label>
                <div className="mt-1">{selectedTx.block}</div>
              </div>
              {selectedTx.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notes / Memo</label>
                  <div className="mt-1">{selectedTx.notes}</div>
                </div>
              )}
              <div className="pt-4 border-t">
                <a
                  href={selectedTx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  View on Block Explorer
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App
