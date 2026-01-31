import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { getSupportedChains } from '../adapters';

interface LandingPageProps {
  onFetch: (chain: string, address: string) => void;
  initialChain?: string;
}

export function LandingPage({ onFetch, initialChain }: LandingPageProps) {
  const chains = getSupportedChains();
  const [selectedChain, setSelectedChain] = useState(initialChain || chains[0]?.id || '');
  const [address, setAddress] = useState('');
  const [showChainDropdown, setShowChainDropdown] = useState(false);

  const selectedChainInfo = chains.find(c => c.id === selectedChain);

  const handleFetch = () => {
    if (!address.trim()) return;
    onFetch(selectedChain, address.trim());
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-slate-200 selection:text-black">
      <header className="w-full z-50">
        <div className="max-w-[1200px] mx-auto px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 liquid-glass rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined !text-[20px] text-slate-700">layers</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight grotesk-tight text-slate-900">TXLedger</h2>
          </div>
          <nav className="hidden md:flex items-center space-x-10">
            <a className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap" href="https://github.com/jdanjohnson/TXLedger" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap" href="#">Docs</a>
            <a className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap" href="#">API</a>
          </nav>
          <div className="flex items-center gap-4">
            <a 
              href="https://awaketax.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-2.5 glass-button-action text-white text-[13px] font-semibold rounded-full"
            >
              AWAKE Tax
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center">
        <section className="w-full max-w-[1100px] px-8 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full badge-glass mb-12">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Open Source Explorer</span>
          </div>
          
          <div className="flex flex-col gap-6 max-w-[850px]">
            <h1 className="text-6xl md:text-[92px] font-bold text-slate-900 grotesk-tight">
              Transact with<br/>
              <span className="opacity-30 italic font-light">LIQUID CLARITY.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 font-medium leading-relaxed max-w-[620px] mx-auto mt-6">
              A multi-chain transaction explorer for AWAKE Tax. 
              View, filter, and export your on-chain activity.
            </p>
          </div>

          <div className="w-full max-w-[760px] mt-24">
            <div className="crystalline-search p-2 rounded-[24px] flex flex-col md:flex-row items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setShowChainDropdown(!showChainDropdown)}
                  className="flex items-center gap-3 px-5 h-14 rounded-2xl hover:bg-white/40 transition-all border border-transparent group"
                >
                  {selectedChainInfo && (
                    <img src={selectedChainInfo.logo} alt={selectedChainInfo.name} className="w-5 h-5 rounded-full" />
                  )}
                  <span className="text-[14px] font-bold text-slate-700">{selectedChainInfo?.name || 'Select Chain'}</span>
                  <ChevronDown className="w-4 h-4 text-slate-300" />
                </button>
                
                {showChainDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50 max-h-80 overflow-y-auto">
                    {[...chains].sort((a, b) => (a.limited ? 1 : 0) - (b.limited ? 1 : 0)).map(chain => (
                      <button
                        key={chain.id}
                        onClick={() => {
                          setSelectedChain(chain.id);
                          setShowChainDropdown(false);
                        }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                      >
                        <img src={chain.logo} alt={chain.name} className="w-5 h-5 rounded-full" />
                        <span className="text-sm font-medium text-slate-700">{chain.name}</span>
                        {chain.limited && (
                          <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                            Coming Soon
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
              
              <div className="flex-1 w-full flex items-center px-4">
                <input 
                  className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-slate-900 placeholder:text-slate-300 text-[16px] font-medium py-3"
                  placeholder={selectedChainInfo?.addressPlaceholder || "Enter wallet address..."}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
                />
              </div>
              
              <button 
                onClick={handleFetch}
                disabled={!address.trim()}
                className="glass-button-action w-full md:w-auto h-14 px-10 rounded-2xl text-white text-[14px] font-bold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Fetch
                <span className="material-symbols-outlined !text-[18px] opacity-60">arrow_forward</span>
              </button>
            </div>

            <div className="mt-12 flex flex-col items-center gap-10">
              <div className="flex items-center gap-6 flex-wrap justify-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined !text-[16px] text-slate-400">shield</span>
                  <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">No Login Required</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-slate-200 hidden sm:block"></div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined !text-[16px] text-slate-400">download</span>
                  <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">CSV Export</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-slate-200 hidden sm:block"></div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined !text-[16px] text-slate-400">code</span>
                  <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Open Source</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-5">
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em]">Supported Networks</span>
                <div className="flex flex-wrap justify-center gap-3">
                  {chains.filter(c => !c.limited).slice(0, 6).map(chain => (
                    <span 
                      key={chain.id}
                      className="px-5 py-2 rounded-full badge-glass text-[11px] font-bold text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-all cursor-pointer flex items-center gap-2"
                      onClick={() => setSelectedChain(chain.id)}
                    >
                      <img src={chain.logo} alt={chain.name} className="w-4 h-4 rounded-full" />
                      {chain.name}
                    </span>
                  ))}
                  {chains.filter(c => !c.limited).length > 6 && (
                    <span className="px-5 py-2 rounded-full badge-glass text-[11px] font-bold text-slate-400">
                      +{chains.filter(c => !c.limited).length - 6} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full py-16">
        <div className="max-w-[1200px] mx-auto px-8 flex flex-col md:flex-row items-center justify-between border-t border-slate-200/50 pt-10">
          <div className="flex items-center gap-8 flex-wrap justify-center md:justify-start">
            <span className="text-[12px] font-bold text-slate-400">© 2026 TXLedger</span>
            <div className="flex items-center gap-6">
              <a className="text-[12px] font-bold text-slate-400 hover:text-slate-900 transition-colors" href="https://github.com/jdanjohnson/TXLedger" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a className="text-[12px] font-bold text-slate-400 hover:text-slate-900 transition-colors" href="https://awaketax.com" target="_blank" rel="noopener noreferrer">AWAKE Tax</a>
            </div>
          </div>
          <div className="flex items-center gap-8 mt-6 md:mt-0">
            <span className="text-[12px] font-semibold text-slate-400">GNU GPLv3 License</span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/5 border border-green-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              <span className="text-[10px] font-bold text-green-600 uppercase tracking-tighter">Open Source</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
