
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BenchmarkDataset, SearchState, ViewMode } from './types';
import { searchBenchmarkDatasets } from './services/geminiService';
import DatasetCard from './components/DatasetCard';

const SEARCH_STATUSES = [
  "Initializing search parameters...",
  "Querying academic databases (arXiv, Scholar)...",
  "Checking Hugging Face datasets...",
  "Identifying benchmark datasets in papers...",
  "Cross-referencing GitHub repositories...",
  "Extracting specifications and metrics...",
  "Analyzing data formats and sizes...",
  "Synthesizing results..."
];

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>({
    isSearching: false,
    results: [],
    progress: 0,
    status: ''
  });
  const [savedDatasets, setSavedDatasets] = useState<BenchmarkDataset[]>([]);
  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  const progressInterval = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved datasets from "database" (localStorage)
  useEffect(() => {
    const stored = localStorage.getItem('benchmark_hub_saved');
    if (stored) {
      try {
        setSavedDatasets(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved datasets", e);
      }
    }
  }, []);

  // Save datasets to "database" (localStorage) whenever they change
  useEffect(() => {
    localStorage.setItem('benchmark_hub_saved', JSON.stringify(savedDatasets));
  }, [savedDatasets]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    // Reset search state
    setSearchState({ 
      isSearching: true, 
      results: [], 
      error: undefined, 
      progress: 5, 
      status: SEARCH_STATUSES[0] 
    });
    setActiveTab('discover');

    // Start progress simulation
    progressInterval.current = window.setInterval(() => {
      setSearchState(prev => {
        if (!prev.isSearching) return prev;
        
        const increment = prev.progress < 40 ? 5 : prev.progress < 70 ? 2 : prev.progress < 90 ? 0.5 : 0;
        const nextProgress = Math.min(prev.progress + increment, 95);
        
        const nextStatusIndex = Math.min(
          Math.floor((nextProgress / 100) * SEARCH_STATUSES.length),
          SEARCH_STATUSES.length - 1
        );

        return {
          ...prev,
          progress: nextProgress,
          status: SEARCH_STATUSES[nextStatusIndex]
        };
      });
    }, 800);

    try {
      const results = await searchBenchmarkDatasets(query);
      if (progressInterval.current) clearInterval(progressInterval.current);
      
      setSearchState({
        isSearching: false,
        results,
        progress: 100,
        status: 'Search complete'
      });
    } catch (error: any) {
      if (progressInterval.current) clearInterval(progressInterval.current);
      setSearchState({
        isSearching: false,
        results: [],
        error: error.message || 'An unexpected error occurred',
        progress: 0,
        status: ''
      });
    }
  };

  const handleSave = useCallback((dataset: BenchmarkDataset) => {
    setSavedDatasets(prev => {
      if (prev.find(d => d.paperLink === dataset.paperLink)) return prev;
      return [...prev, dataset];
    });
  }, []);

  const handleSaveAll = () => {
    const newItems = searchState.results.filter(
      res => !savedDatasets.some(saved => saved.paperLink === res.paperLink)
    );
    if (newItems.length > 0) {
      setSavedDatasets(prev => [...prev, ...newItems]);
    }
  };

  const handleRemove = useCallback((id: string) => {
    setSavedDatasets(prev => prev.filter(d => d.id !== id));
  }, []);

  const handleExportCSV = () => {
    if (savedDatasets.length === 0) return;

    const headers = ['Title', 'Source', 'Authors', 'Year', 'Paper Link', 'GitHub Link', 'Item Count', 'Specs', 'Description'];
    const rows = savedDatasets.map(d => [
      `"${(d.title || '').replace(/"/g, '""')}"`,
      d.source,
      `"${(d.authors?.join(', ') || '').replace(/"/g, '""')}"`,
      d.year || '',
      d.paperLink,
      d.githubLink || '',
      `"${(d.itemCount || '').replace(/"/g, '""')}"`,
      `"${(d.specs || '').replace(/"/g, '""')}"`,
      `"${(d.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `benchmark_library_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSVLine = (line: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.length < 2) return;

      const newDatasets: BenchmarkDataset[] = [];
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const columns = parseCSVLine(lines[i]);
        if (columns.length < 9) continue;

        const dataset: BenchmarkDataset = {
          id: `${Date.now()}-${i}`,
          title: columns[0],
          source: columns[1] as any,
          authors: columns[2].split(',').map(a => a.trim()).filter(a => a),
          year: columns[3],
          paperLink: columns[4],
          githubLink: columns[5] || undefined,
          itemCount: columns[6],
          specs: columns[7],
          description: columns[8]
        };
        newDatasets.push(dataset);
      }

      setSavedDatasets(prev => {
        const merged = [...prev];
        newDatasets.forEach(nd => {
          if (!merged.find(m => m.paperLink === nd.paperLink)) {
            merged.push(nd);
          }
        });
        return merged;
      });

      // Clear the input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const isSaved = (link: string) => savedDatasets.some(d => d.paperLink === link);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-slate-900 p-1.5 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">BenchmarkHub</h1>
            </div>
            
            <nav className="flex space-x-1">
              <button
                onClick={() => setActiveTab('discover')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'discover' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                Discover
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors relative ${
                  activeTab === 'saved' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                My Library
                {savedDatasets.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-slate-900 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {savedDatasets.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="max-w-3xl mx-auto mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Find the Gold Standard
            </h2>
            <p className="mt-3 text-lg text-slate-500">
              Search arXiv, Hugging Face, and more for SOTA benchmark datasets and papers.
            </p>
          </div>

          <form onSubmit={handleSearch} className="relative group">
            <input
              type="text"
              className="w-full pl-12 pr-28 py-4 bg-white border border-slate-300 rounded-2xl shadow-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none text-lg transition-all"
              placeholder="e.g., Medical Image Segmentation, LLM Reasoning..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={searchState.isSearching}
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" x2="16.65" y1="21" y2="16.65"></line></svg>
            </div>
            <button
              type="submit"
              disabled={searchState.isSearching || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {searchState.isSearching ? (
                <div className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Searching...</span>
                </div>
              ) : 'Search'}
            </button>
          </form>

          {/* Progress Bar and Status */}
          {searchState.isSearching && (
            <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-600">{searchState.status}</span>
                <span className="text-sm font-bold text-slate-900">{Math.round(searchState.progress)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-slate-900 h-full transition-all duration-300 ease-out"
                  style={{ width: `${searchState.progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* View Controls & Action Buttons */}
        <div className="mb-6 flex flex-wrap justify-between items-center gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900">
              {activeTab === 'discover' ? 'Search Results' : 'My Library'}
            </h2>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                title="Grid View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                title="List View"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'discover' && searchState.results.length > 0 && !searchState.isSearching && (
              <button
                onClick={handleSaveAll}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                Select All
              </button>
            )}
            {activeTab === 'saved' && (
              <>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImportCSV}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" /></svg>
                  Import CSV
                </button>
                {savedDatasets.length > 0 && (
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003 3h-10a3 3 0 00-3-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export CSV
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Results Area */}
        <section>
          {activeTab === 'discover' ? (
            <>
              {searchState.error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>{searchState.error}</span>
                </div>
              )}

              {searchState.isSearching ? (
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`animate-pulse bg-white border border-slate-200 rounded-xl p-6 ${viewMode === 'list' ? 'h-24' : 'h-80'}`}>
                      <div className="h-4 bg-slate-200 rounded w-1/4 mb-4"></div>
                      <div className="h-6 bg-slate-200 rounded w-3/4 mb-2"></div>
                    </div>
                  ))}
                </div>
              ) : searchState.results.length > 0 ? (
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
                  {searchState.results.map((dataset) => (
                    <DatasetCard
                      key={dataset.id}
                      dataset={dataset}
                      onSave={handleSave}
                      isSaved={isSaved(dataset.paperLink)}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              ) : !searchState.error && (
                <div className="text-center py-20 text-slate-400">
                  <div className="mb-4 flex justify-center">
                    <svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <p className="text-lg">No results to show. Start by searching for a topic.</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              {savedDatasets.length > 0 ? (
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
                  {savedDatasets.map((dataset) => (
                    <DatasetCard
                      key={dataset.id}
                      dataset={dataset}
                      onRemove={handleRemove}
                      isSaved={true}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
                  <p className="text-lg mb-4">Your library is empty.</p>
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="text-slate-900 font-semibold hover:underline"
                  >
                    Go discover new benchmarks
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="bg-slate-50 border-t border-slate-200 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">About</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                BenchmarkHub uses Google Gemini 3's advanced reasoning and search capabilities to aggregate the most relevant benchmark datasets for researchers and engineers.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Sources</h4>
              <ul className="text-sm text-slate-500 space-y-2">
                <li>arXiv.org</li>
                <li>Hugging Face Datasets</li>
                <li>Google Scholar</li>
                <li>Semantic Scholar</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Storage</h4>
              <p className="text-sm text-slate-500 leading-relaxed">
                Your saved benchmarks are stored locally in your browser's persistent storage, ensuring you always have access to your research library.
              </p>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs">
            © {new Date().getFullYear()} BenchmarkHub. Research made faster with AI.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
