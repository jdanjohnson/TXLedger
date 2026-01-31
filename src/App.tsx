import { useState, useMemo } from 'react';
import { Search, Download, ExternalLink, ChevronDown, ChevronUp, X, Loader2, ArrowUpDown, ArrowLeft, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { LandingPage } from './components/LandingPage';
import './App.css';

type ViewMode = 'landing' | 'explorer';

function App() {
  const chains = getSupportedChains();
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [selectedChain, setSelectedChain] = useState(chains[0]?.id || '');
  const [address, setAddress] = useState('');
  const [selectedTx, setSelectedTx] = useState<NormalizedTransaction | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleFetchFromLanding = (chain: string, addr: string) => {
    setSelectedChain(chain);
    setAddress(addr);
    fetchTransactions(chain, addr);
    setViewMode('explorer');
  };

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

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBackToLanding = () => {
    setViewMode('landing');
  };

  const handleChainChange = (newChain: string) => {
    setSelectedChain(newChain);
    setAddress('');
    setSelectedTx(null);
    setViewMode('landing');
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
      in: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
      out: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
      self: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
      unknown: 'bg-slate-100 text-slate-600 border border-slate-200',
    };
    return (
      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${colors[direction] || colors.unknown}`}>
        {direction}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { dot: string; text: string }> = {
      success: { dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]', text: 'text-slate-600' },
      failed: { dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]', text: 'text-slate-600' },
      pending: { dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]', text: 'text-slate-600' },
    };
    const style = styles[status] || { dot: 'bg-slate-400', text: 'text-slate-600' };
    return (
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></div>
        <span className={`text-[11px] font-bold uppercase tracking-wider ${style.text}`}>{status}</span>
      </div>
    );
  };

  const getPerpsTagBadge = (tag: string) => {
    const colors: Record<string, string> = {
      open_position: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
      close_position: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
      funding_payment: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    };
    const labels: Record<string, string> = {
      open_position: 'Open',
      close_position: 'Close',
      funding_payment: 'Funding',
    };
    return (
      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${colors[tag] || 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
        {labels[tag] || tag}
      </span>
    );
  };

  const isPerpsChain = selectedChainInfo?.isPerps || false;

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortOrder === 'asc' ? 
      <ChevronUp className="h-3.5 w-3.5 ml-1" /> : 
      <ChevronDown className="h-3.5 w-3.5 ml-1" />;
  };

  if (viewMode === 'landing') {
    return <LandingPage onFetch={handleFetchFromLanding} initialChain={selectedChain} />;
  }

  return (
    <div className="flex flex-col w-full max-w-[1440px] mx-auto min-h-screen relative overflow-hidden">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50/50 rounded-full blur-[120px] -z-10"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-slate-100/50 rounded-full blur-[100px] -z-10"></div>
      
      <header className="flex items-center justify-between glass px-8 py-3 sticky top-4 z-50 mx-6 mt-4 rounded-2xl">
        <div className="flex items-center gap-12">
          <button onClick={handleBackToLanding} className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
            <div className="bg-slate-900 text-white w-8 h-8 flex items-center justify-center rounded-lg shadow-lg">
              <span className="material-symbols-outlined !text-[18px]">layers</span>
            </div>
            <h1 className="text-sm font-extrabold tracking-tighter text-slate-900">TX<span className="text-slate-500 font-medium">Ledger</span></h1>
          </button>
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={handleBackToLanding} className="text-[13px] font-medium text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <span className="text-[13px] font-semibold text-slate-900 border-b-2 border-slate-900 py-1">Transactions</span>
          </nav>
        </div>
        <div className="flex items-center gap-5">
          <Select value={selectedChain} onValueChange={handleChainChange}>
            <SelectTrigger className="w-40 h-8 text-xs border-slate-200 bg-white/50">
              <SelectValue placeholder="Select chain" />
            </SelectTrigger>
            <SelectContent>
              {[...chains].sort((a, b) => (a.limited ? 1 : 0) - (b.limited ? 1 : 0)).map(chain => (
                <SelectItem key={chain.id} value={chain.id}>
                  <div className="flex items-center gap-2">
                    <img src={chain.logo} alt={chain.name} className="w-4 h-4 rounded-full" />
                    <span className="text-xs">{chain.name}</span>
                    {chain.limited && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Soon</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="h-4 w-px bg-slate-200"></div>
          <a 
            href="https://jadanj.com/experiments" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            jadan.dev
          </a>
        </div>
      </header>

      <main className="flex-1 px-8 py-10 flex flex-col gap-8">
        <div className="glass p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-8 border-white/60">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Active Wallet</span>
              {selectedChainInfo && (
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[9px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <img src={selectedChainInfo.logo} alt={selectedChainInfo.name} className="w-3 h-3 rounded-full" />
                  {selectedChainInfo.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <h2 className="text-2xl md:text-3xl font-light text-slate-900 tracking-tight font-mono">
                {shortenAddress(address) || 'No address'}
              </h2>
              <button 
                onClick={handleCopyAddress}
                className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-slate-600"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1">Total Transactions</span>
                <span className="tabular text-lg font-semibold text-slate-900">
                  {transactions.length.toLocaleString()}
                  {totalCount && totalCount > transactions.length && (
                    <span className="text-slate-400 font-medium text-sm ml-1">of {totalCount.toLocaleString()}</span>
                  )}
                </span>
              </div>
              {transactions.length > 0 && (
                <>
                  <div className="h-10 w-px bg-slate-200/50"></div>
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1">Date Range</span>
                    <span className="text-sm font-medium text-slate-700">
                      {formatDate(transactions[transactions.length - 1]?.datetimeUtc)} - {formatDate(transactions[0]?.datetimeUtc)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="New address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                className="w-48 h-10 text-xs font-mono bg-white/50 border-slate-200"
              />
              <Button 
                onClick={handleFetch} 
                disabled={loading || !address.trim()}
                variant="outline"
                className="h-10 px-4 text-xs font-semibold"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
              </Button>
            </div>
            <button 
              onClick={handleExportCsv}
              disabled={transactions.length === 0}
              className="awaken-glow flex items-center gap-2 bg-slate-950 text-white px-5 py-2.5 rounded-xl text-[12px] font-semibold hover:bg-slate-800 transition-all relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <Download className="w-4 h-4 text-cyan-400" />
              Download CSV
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ml-1"></span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50/80 backdrop-blur-sm border border-rose-200 rounded-xl text-rose-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-8">
              <button 
                onClick={() => setFilters({ ...filters, direction: 'all' })}
                className={`text-[13px] font-medium pb-2 transition-colors ${filters.direction === 'all' ? 'font-bold text-slate-900 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-900'}`}
              >
                All Activity
              </button>
              <button 
                onClick={() => setFilters({ ...filters, direction: 'in' })}
                className={`text-[13px] font-medium pb-2 transition-colors ${filters.direction === 'in' ? 'font-bold text-slate-900 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-900'}`}
              >
                Incoming
              </button>
              <button 
                onClick={() => setFilters({ ...filters, direction: 'out' })}
                className={`text-[13px] font-medium pb-2 transition-colors ${filters.direction === 'out' ? 'font-bold text-slate-900 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-900'}`}
              >
                Outgoing
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-9 h-8 w-48 text-xs bg-white/50 border-slate-200"
                />
              </div>
              <Select
                value={filters.type || 'all'}
                onValueChange={(value) => setFilters({ ...filters, type: value === 'all' ? '' : value })}
              >
                <SelectTrigger className="w-28 h-8 text-xs border-slate-200 bg-white/50">
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
                <SelectTrigger className="w-28 h-8 text-xs border-slate-200 bg-white/50">
                  <SelectValue placeholder="Asset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assets</SelectItem>
                  {uniqueAssets.map(asset => (
                    <SelectItem key={asset} value={asset}>{asset}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {filteredTransactions.length} Transactions
              </div>
            </div>
          </div>

          {transactions.length > 0 ? (
            <div className="glass rounded-3xl overflow-hidden border-white/60">
              <Table>
                <TableHeader>
                  <TableRow className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="py-4 px-6 font-bold">Status</TableHead>
                    <TableHead 
                      className="py-4 px-6 font-bold cursor-pointer hover:text-slate-900"
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center">
                        Timestamp
                        <SortIcon column="date" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="py-4 px-6 font-bold cursor-pointer hover:text-slate-900"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center">
                        Action
                        <SortIcon column="type" />
                      </div>
                    </TableHead>
                    <TableHead className="py-4 px-6 font-bold">{isPerpsChain ? 'Position' : 'Direction'}</TableHead>
                    <TableHead 
                      className="py-4 px-6 font-bold text-right cursor-pointer hover:text-slate-900"
                      onClick={() => handleSort('amount')}
                    >
                      <div className="flex items-center justify-end">
                        {isPerpsChain ? 'Size' : 'Value'}
                        <SortIcon column="amount" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="py-4 px-6 font-bold cursor-pointer hover:text-slate-900"
                      onClick={() => handleSort('asset')}
                    >
                      <div className="flex items-center">
                        Asset
                        <SortIcon column="asset" />
                      </div>
                    </TableHead>
                    {isPerpsChain && (
                      <TableHead 
                        className="py-4 px-6 font-bold text-right cursor-pointer hover:text-slate-900"
                        onClick={() => handleSort('pnl')}
                      >
                        <div className="flex items-center justify-end">
                          P&L
                          <SortIcon column="pnl" />
                        </div>
                      </TableHead>
                    )}
                    <TableHead 
                      className="py-4 px-6 font-bold text-right cursor-pointer hover:text-slate-900"
                      onClick={() => handleSort('fee')}
                    >
                      <div className="flex items-center justify-end">
                        Fee
                        <SortIcon column="fee" />
                      </div>
                    </TableHead>
                    <TableHead className="py-4 px-6 font-bold">Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100/50">
                  {filteredTransactions.map((tx) => (
                    <TableRow 
                      key={tx.hash} 
                      className="glass-hover group cursor-pointer"
                      onClick={() => setSelectedTx(tx)}
                    >
                      <TableCell className="py-4 px-6 whitespace-nowrap">
                        {getStatusBadge(tx.status)}
                      </TableCell>
                      <TableCell className="py-4 px-6 whitespace-nowrap">
                        <span className="text-[12px] tabular text-slate-500 font-medium">
                          {new Date(tx.datetimeUtc).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                          <span className="text-slate-300 ml-2">
                            {new Date(tx.datetimeUtc).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-6 whitespace-nowrap">
                        <span className="text-[12px] font-semibold text-slate-700">{tx.type}</span>
                      </TableCell>
                      <TableCell className="py-4 px-6 whitespace-nowrap">
                        {isPerpsChain && tx.tag ? getPerpsTagBadge(tx.tag) : getDirectionBadge(tx.direction)}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right whitespace-nowrap">
                        <span className={`text-[13px] tabular font-semibold ${tx.direction === 'in' ? 'text-emerald-600' : tx.direction === 'out' ? 'text-slate-900' : 'text-slate-600'}`}>
                          {tx.direction === 'in' ? '+' : tx.direction === 'out' ? '-' : ''}{parseFloat(tx.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-6 whitespace-nowrap">
                        <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 bg-slate-100 rounded-md font-mono">{tx.asset}</span>
                      </TableCell>
                      {isPerpsChain && (
                        <TableCell className="py-4 px-6 text-right whitespace-nowrap">
                          <span className={`text-[13px] tabular font-semibold ${parseFloat(tx.pnl || '0') > 0 ? 'text-emerald-600' : parseFloat(tx.pnl || '0') < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {parseFloat(tx.pnl || '0') > 0 ? '+' : ''}{parseFloat(tx.pnl || '0').toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="py-4 px-6 text-right whitespace-nowrap">
                        <span className="text-[13px] tabular text-slate-400 font-medium">
                          {parseFloat(tx.fee).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-6 whitespace-nowrap">
                        <a
                          href={tx.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] font-mono text-slate-400 group-hover:text-slate-900 transition-colors flex items-center gap-1"
                        >
                          {shortenHash(tx.hash)}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {hasMore && (
                <div className="p-4 border-t border-slate-100 text-center">
                  <Button variant="outline" onClick={loadMore} disabled={loading} className="text-xs">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More Transactions'
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : !loading && (
            <div className="glass rounded-3xl p-16 text-center border-white/60">
              <div className="text-slate-300 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No transactions found</h3>
              <p className="text-slate-500 text-sm">
                Enter a wallet address above to fetch and view transactions
              </p>
            </div>
          )}

          {loading && transactions.length === 0 && (
            <div className="glass rounded-3xl p-16 text-center border-white/60">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Fetching transactions...</h3>
              <p className="text-slate-500 text-sm">
                This may take a moment depending on the number of transactions
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="px-8 py-6 border-t border-slate-200/50">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>TXLedger - GNU GPLv3 License</span>
          <div className="flex items-center gap-4">
            <a href="https://github.com/jdanjohnson/TXLedger" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 transition-colors">GitHub</a>
            <a href="https://jadanj.com/experiments" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 transition-colors">jadan.dev</a>
          </div>
        </div>
      </footer>

      {selectedTx && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-lg h-full overflow-y-auto shadow-2xl border-l border-slate-200">
            <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Transaction Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTx(null)} className="hover:bg-slate-100">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                {getStatusBadge(selectedTx.status)}
                {getDirectionBadge(selectedTx.direction)}
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction Hash</label>
                <div className="font-mono text-sm break-all text-slate-900 bg-slate-50 p-3 rounded-lg">{selectedTx.hash}</div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date & Time (UTC)</label>
                <div className="text-slate-900">{new Date(selectedTx.datetimeUtc).toUTCString()}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</label>
                  <div className="text-slate-900 font-medium">{selectedTx.type}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Block</label>
                  <div className="text-slate-900 font-mono">{selectedTx.block}</div>
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Counterparty</label>
                <div className="font-mono text-sm break-all text-slate-900 bg-slate-50 p-3 rounded-lg">{selectedTx.counterparty}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asset</label>
                  <div className="text-slate-900 font-medium">{selectedTx.asset}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</label>
                  <div className={`font-mono font-semibold ${selectedTx.direction === 'in' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {selectedTx.direction === 'in' ? '+' : ''}{selectedTx.amount}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fee</label>
                  <div className="font-mono text-slate-900">{selectedTx.fee} {selectedTx.feeAsset}</div>
                </div>
                {isPerpsChain && selectedTx.pnl && parseFloat(selectedTx.pnl) !== 0 && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Realized P&L</label>
                    <div className={`font-mono font-semibold ${parseFloat(selectedTx.pnl) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {parseFloat(selectedTx.pnl) > 0 ? '+' : ''}{parseFloat(selectedTx.pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedTx.paymentToken || selectedTx.feeAsset}
                    </div>
                  </div>
                )}
              </div>
              
              {selectedTx.notes && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notes / Memo</label>
                  <div className="text-slate-900 bg-slate-50 p-3 rounded-lg">{selectedTx.notes}</div>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-200">
                <a
                  href={selectedTx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  View on Explorer
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

export default App;
