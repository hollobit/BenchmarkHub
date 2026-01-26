
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BenchmarkDataset, SearchState, ViewMode, SortConfig, SortField, SortOrder, AppSettings } from './types';
import { searchBenchmarkDatasets } from './services/geminiService';
import DatasetCard from './components/DatasetCard';
import ComparisonModal from './components/ComparisonModal';
import SettingsModal from './components/SettingsModal';

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

const DEFAULT_SETTINGS: AppSettings = {
  model: 'gemini-3-pro-preview'
};

const MAX_HISTORY_ITEMS = 8;

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchState, setSearchState] = useState<SearchState>({
    isSearching: false,
    results: [],
    progress: 0,
    status: ''
  });
  const [savedDatasets, setSavedDatasets] = useState<BenchmarkDataset[]>([]);
  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'year', order: 'desc' });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const progressInterval = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load state from localStorage on mount.
  useEffect(() => {
    const storedLib = localStorage.getItem('benchmark_hub_saved');
    if (storedLib) {
      try { setSavedDatasets(JSON.parse(storedLib)); } catch (e) { console.error(e); }
    }
    const storedSettings = localStorage.getItem('benchmark_hub_settings');
    if (storedSettings) {
      try { setSettings(JSON.parse(storedSettings)); } catch (e) { console.error(e); }
    }
    const storedHistory = localStorage.getItem('benchmark_hub_history');
    if (storedHistory) {
      try { setSearchHistory(JSON.parse(storedHistory)); } catch (e) { console.error(e); }
    }

    const initializeApiKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await aistudio.openSelectKey();
        }
      }
    };
    initializeApiKey();
  }, []);

  // Persist state.
  useEffect(() => {
    localStorage.setItem('benchmark_hub_saved', JSON.stringify(savedDatasets));
  }, [savedDatasets]);

  useEffect(() => {
    localStorage.setItem('benchmark_hub_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('benchmark_hub_history', JSON.stringify(searchHistory));
  }, [searchHistory]);

  const addToHistory = (newQuery: string) => {
    setSearchHistory(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== newQuery.toLowerCase());
      const updated = [newQuery, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      return updated;
    });
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('benchmark_hub_history');
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const activeQuery = overrideQuery !== undefined ? overrideQuery : query;
    if (!activeQuery.trim()) return;

    if (overrideQuery !== undefined) {
      setQuery(overrideQuery);
    }

    addToHistory(activeQuery);

    setSearchState({ 
      isSearching: true, 
      results: [], 
      error: undefined, 
      progress: 5, 
      status: SEARCH_STATUSES[0] 
    });
    setActiveTab('discover');
    setFilterQuery(''); 

    progressInterval.current = window.setInterval(() => {
      setSearchState(prev => {
        if (!prev.isSearching) return prev;
        const increment = prev.progress < 40 ? 5 : prev.progress < 70 ? 2 : prev.progress < 90 ? 0.5 : 0;
        const nextProgress = Math.min(prev.progress + increment, 95);
        const nextStatusIndex = Math.min(
          Math.floor((nextProgress / 100) * SEARCH_STATUSES.length),
          SEARCH_STATUSES.length - 1
        );
        return { ...prev, progress: nextProgress, status: SEARCH_STATUSES[nextStatusIndex] };
      });
    }, 800);

    try {
      const results = await searchBenchmarkDatasets(activeQuery, settings.model);
      if (progressInterval.current) clearInterval(progressInterval.current);
      setSearchState({ isSearching: false, results, progress: 100, status: 'Search complete' });
    } catch (error: any) {
      if (progressInterval.current) clearInterval(progressInterval.current);
      setSearchState({ isSearching: false, results: [], error: error.message || 'An unexpected error occurred', progress: 0, status: '' });
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
    setSelectedForComparison(prev => prev.filter(sid => sid !== id));
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
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const columns = parseCSVLine(lines[i]);
        if (columns.length < 9) continue;
        newDatasets.push({
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
        });
      }
      setSavedDatasets(prev => {
        const merged = [...prev];
        newDatasets.forEach(nd => {
          if (!merged.find(m => m.paperLink === nd.paperLink)) merged.push(nd);
        });
        return merged;
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const parseCSVLine = (line: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) { result.push(current); current = ''; } else { current += char; }
    }
    result.push(current);
    return result;
  };

  const filterAndSortItems = useCallback((items: BenchmarkDataset[]) => {
    let result = [...items];

    if (filterQuery.trim()) {
      const lQuery = filterQuery.toLowerCase();
      result = result.filter(item => {
        const searchableText = [
          item.title,
          item.description,
          item.source,
          item.year,
          item.specs,
          item.itemCount,
          ...(item.authors || [])
        ].join(' ').toLowerCase();
        return searchableText.includes(lQuery);
      });
    }

    return result.sort((a, b) => {
      let valA: string = (a[sortConfig.field] || '').toString().toLowerCase();
      let valB: string = (b[sortConfig.field] || '').toString().toLowerCase();

      if (sortConfig.field === 'year') {
        const yearA = parseInt(valA) || 0;
        const yearB = parseInt(valB) || 0;
        if (sortConfig.order === 'asc') return yearA - yearB;
        return yearB - yearA;
      }

      if (sortConfig.order === 'asc') return valA.localeCompare(valB);
      return valB.localeCompare(valA);
    });
  }, [sortConfig, filterQuery]);

  const displayedResults = useMemo(() => filterAndSortItems(searchState.results), [searchState.results, filterAndSortItems]);
  const displayedSaved = useMemo(() => filterAndSortItems(savedDatasets), [savedDatasets, filterAndSortItems]);

  const toggleSelectForComparison = (id: string) => {
    setSelectedForComparison(prev => {
      if (prev.includes(id)) return prev.filter(sid => sid !== id);
      if (prev.length >= 10) {
        alert("You can compare up to 10 datasets at once.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleClearSelection = () => {
    setSelectedForComparison([]);
  };

  const isSaved = (link: string) => savedDatasets.some(d => d.paperLink === link);
  const selectedDatasets = savedDatasets.filter(d => selectedForComparison.includes(d.id));

  return (
    <div className="min-h-screen flex flex-col">
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
            
            <div className="flex items-center gap-4">
              <nav className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('discover')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors relative flex items-center gap-2 ${activeTab === 'discover' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                  <span>Discover</span>
                  {searchState.results.length > 0 && (
                    <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {searchState.results.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('saved')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors relative flex items-center gap-2 ${activeTab === 'saved' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                >
                  <span>My Library</span>
                  {savedDatasets.length > 0 && (
                    <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {savedDatasets.length}
                    </span>
                  )}
                </button>
              </nav>

              <div className="w-px h-6 bg-slate-200"></div>

              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all relative"
                title="Configuration"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {settings.model !== DEFAULT_SETTINGS.model && <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full border border-white"></div>}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="max-w-3xl mx-auto mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">Find the Gold Standard</h2>
            <p className="mt-3 text-lg text-slate-500">Search arXiv, Hugging Face, and more for SOTA benchmark datasets and papers.</p>
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

          {searchHistory.length > 0 && !searchState.isSearching && (
            <div className="mt-4 animate-in fade-in duration-500">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Searches</span>
                <button 
                  onClick={clearHistory}
                  className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors"
                >
                  Clear History
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearch(undefined, h)}
                    className="px-3 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-full text-xs transition-all border border-slate-200 hover:border-indigo-200"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchState.isSearching && (
            <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-600">{searchState.status}</span>
                <span className="text-sm font-bold text-slate-900">{Math.round(searchState.progress)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="bg-slate-900 h-full transition-all duration-300 ease-out" style={{ width: `${searchState.progress}%` }}></div>
              </div>
            </div>
          )}
        </div>

        {/* View Controls & Action Buttons */}
        <div className="mb-6 flex flex-wrap justify-between items-center gap-4 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{activeTab === 'discover' ? 'Search Results' : 'Saved Library'}</h2>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold text-xs">
                {activeTab === 'discover' ? displayedResults.length : displayedSaved.length} items
              </span>
            </div>
            
            <div className="relative">
              <input
                type="text"
                placeholder="Filter current view..."
                className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all w-48 sm:w-64"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`} title="Grid View">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`} title="List View">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select 
                id="sort-select"
                className="bg-slate-100 border-none text-sm rounded-lg focus:ring-indigo-500 py-1.5 pl-3 pr-8 font-medium text-slate-700"
                value={`${sortConfig.field}-${sortConfig.order}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as [SortField, SortOrder];
                  setSortConfig({ field, order });
                }}
              >
                <option value="year-desc">Newest First</option>
                <option value="year-asc">Oldest First</option>
                <option value="title-asc">Name (A-Z)</option>
                <option value="title-desc">Name (Z-A)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'discover' && searchState.results.length > 0 && !searchState.isSearching && (
              <button onClick={handleSaveAll} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                Save All Results
              </button>
            )}
            {activeTab === 'saved' && (
              <>
                <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleImportCSV} />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" /></svg>
                  Import
                </button>
                {savedDatasets.length > 0 && (
                  <button 
                    onClick={handleExportCSV} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export
                  </button>
                )}
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                {selectedForComparison.length > 0 && (
                  <button 
                    onClick={handleClearSelection}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors border border-slate-200"
                  >
                    Clear Selected
                  </button>
                )}
                {selectedForComparison.length > 1 && (
                  <button 
                    onClick={() => setIsComparing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 animate-in zoom-in-95"
                  >
                    Compare ({selectedForComparison.length})
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <section>
          {activeTab === 'discover' ? (
            <>
              {searchState.error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-3"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>{searchState.error}</span></div>}
              
              {searchState.isSearching ? (
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
                  {[...Array(6)].map((_, i) => <div key={i} className={`animate-pulse bg-white border border-slate-200 rounded-xl p-6 ${viewMode === 'list' ? 'h-24' : 'h-80'}`}><div className="h-4 bg-slate-200 rounded w-1/4 mb-4"></div><div className="h-6 bg-slate-200 rounded w-3/4 mb-2"></div></div>)}
                </div>
              ) : displayedResults.length > 0 ? (
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
                  {displayedResults.map((dataset) => <DatasetCard key={dataset.id} dataset={dataset} onSave={handleSave} isSaved={isSaved(dataset.paperLink)} viewMode={viewMode} />)}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-400">
                  <p className="text-lg">
                    {filterQuery ? `No results matching "${filterQuery}"` : 'Enter a topic above to search for benchmarks.'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              {displayedSaved.length > 0 ? (
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
                  {displayedSaved.map((dataset) => (
                    <DatasetCard 
                      key={dataset.id} 
                      dataset={dataset} 
                      onRemove={handleRemove} 
                      isSaved={true} 
                      viewMode={viewMode}
                      showSelection={true}
                      isSelected={selectedForComparison.includes(dataset.id)}
                      onToggleSelect={toggleSelectForComparison}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
                  <p className="text-lg mb-4">Your library is empty.</p>
                  <button onClick={() => setActiveTab('discover')} className="text-indigo-600 font-semibold hover:underline">Go discover new benchmarks</button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Modals */}
      {isComparing && (
        <ComparisonModal 
          datasets={selectedDatasets} 
          filterQuery={filterQuery}
          onClose={() => setIsComparing(false)} 
        />
      )}

      {isSettingsOpen && (
        <SettingsModal 
          settings={settings}
          onUpdate={setSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      <footer className="bg-slate-50 border-t border-slate-200 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-slate-400 text-xs">© {new Date().getFullYear()} BenchmarkHub. Research made faster with Gemini AI.</div>
        </div>
      </footer>
    </div>
  );
};

export default App;
