import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BenchmarkDataset, SearchState, ViewMode, SortConfig, SortField, SortOrder, AppSettings, DatasetList } from './types';
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
const SOURCES = ['All', 'arXiv', 'Hugging Face', 'Scholar', 'Semantic Scholar', 'Other'];

const FALLBACK_DATASETS: BenchmarkDataset[] = [
  {
    id: 'fb-1',
    title: 'MedMNIST v2',
    source: 'arXiv',
    authors: ['Jiancheng Yang', 'Rui Shi'],
    year: '2021',
    paperLink: 'https://arxiv.org/abs/2110.14795',
    description: 'A large-scale MNIST-like collection of standardized biomedical images, designed to be a lightweight benchmark for 2D and 3D biomedical image classification.',
    itemCount: '708,069 images',
    specs: '2D/3D Classification'
  },
  {
    id: 'fb-2',
    title: 'MMLU',
    source: 'arXiv',
    authors: ['Dan Hendrycks'],
    year: '2020',
    paperLink: 'https://arxiv.org/abs/2009.03300',
    description: 'A massive benchmark that covers 57 subjects across STEM, the humanities, the social sciences, and more.',
    itemCount: '15,908 questions',
    specs: 'Multiple-choice Text'
  },
  {
    id: 'fb-3',
    title: 'SWE-bench',
    source: 'arXiv',
    authors: ['Carlos E. Jimenez'],
    year: '2023',
    paperLink: 'https://arxiv.org/abs/2310.06770',
    description: 'A benchmark for evaluating large language models on real-world software engineering issues collected from GitHub.',
    itemCount: '2,294 tasks',
    specs: 'Code/Docker'
  }
];

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchState, setSearchState] = useState<SearchState>({
    isSearching: false,
    results: [],
    progress: 0,
    status: ''
  });
  
  const [savedDatasets, setSavedDatasets] = useState<BenchmarkDataset[]>([]);
  const [recommendedDatasets, setRecommendedDatasets] = useState<BenchmarkDataset[]>([]);
  const [customLists, setCustomLists] = useState<DatasetList[]>([]);
  const [activeListId, setActiveListId] = useState<string>('all'); 
  
  const [activeTab, setActiveTab] = useState<'saved' | 'recommend' | 'discover'>('saved');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'year', order: 'desc' });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [selectedForComparisonLinks, setSelectedForComparisonLinks] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const progressInterval = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const isInitialized = useRef(false);

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

  const loadRecommendedData = async () => {
    try {
      const response = await fetch('bp-dataset.json');
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      
      const data = await response.json();
      if (!Array.isArray(data)) return FALLBACK_DATASETS;
      
      return data as BenchmarkDataset[];
    } catch (e) {
      console.error("Failed to load recommendation JSON, using fallbacks:", e);
      return FALLBACK_DATASETS;
    }
  };

  useEffect(() => {
    const init = async () => {
      const jsonItems = await loadRecommendedData();
      setRecommendedDatasets(jsonItems);

      const storedLib = localStorage.getItem('benchmark_hub_saved');
      if (storedLib) {
        try { 
          const parsed = JSON.parse(storedLib);
          if (Array.isArray(parsed)) {
            setSavedDatasets(parsed);
          }
        } catch (e) { 
          console.error("Error parsing saved library", e);
        }
      } else {
        setSavedDatasets(jsonItems.slice(0, 5));
      }

      const storedLists = localStorage.getItem('benchmark_hub_lists');
      if (storedLists) {
        try { setCustomLists(JSON.parse(storedLists)); } catch (e) { console.error(e); }
      }

      const storedSettings = localStorage.getItem('benchmark_hub_settings');
      if (storedSettings) {
        try { setSettings(JSON.parse(storedSettings)); } catch (e) { console.error(e); }
      }
      
      const storedHistory = localStorage.getItem('benchmark_hub_history');
      if (storedHistory) {
        try { setSearchHistory(JSON.parse(storedHistory)); } catch (e) { console.error(e); }
      }

      isInitialized.current = true;
    };
    init();
  }, []);

  useEffect(() => { 
    if (isInitialized.current) {
      localStorage.setItem('benchmark_hub_saved', JSON.stringify(savedDatasets)); 
    }
  }, [savedDatasets]);

  useEffect(() => { 
    if (isInitialized.current) {
      localStorage.setItem('benchmark_hub_lists', JSON.stringify(customLists)); 
    }
  }, [customLists]);

  useEffect(() => { 
    if (isInitialized.current) {
      localStorage.setItem('benchmark_hub_settings', JSON.stringify(settings)); 
    }
  }, [settings]);

  useEffect(() => { 
    if (isInitialized.current) {
      localStorage.setItem('benchmark_hub_history', JSON.stringify(searchHistory)); 
    }
  }, [searchHistory]);

  const handleResetLibrary = () => {
    if (confirm("Clear your library and lists?")) {
      setSavedDatasets([]);
      setCustomLists([]);
      setActiveListId('all');
      setSelectedForComparisonLinks([]);
    }
  };

  const handleExport = () => {
    const headers = ["Title", "Source", "Authors", "Year", "Paper Link", "GitHub Link", "Item Count", "Specs", "Description"];
    const escapeCSV = (str: string = "") => {
      const sanitized = str.replace(/"/g, '""');
      return `"${sanitized}"`;
    };
    const rows = savedDatasets.map(d => [
      escapeCSV(d.title),
      escapeCSV(d.source),
      escapeCSV(d.authors?.join(", ")),
      escapeCSV(d.year),
      escapeCSV(d.paperLink),
      escapeCSV(d.githubLink),
      escapeCSV(d.itemCount),
      escapeCSV(d.specs),
      escapeCSV(d.description)
    ].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `benchmark-library-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const jsonContent = JSON.stringify(savedDatasets, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `benchmark-library-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return;

        const newDatasets: BenchmarkDataset[] = [];
        const existingLinks = new Set(savedDatasets.map(d => d.paperLink));

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const cols = parseCSVLine(lines[i]);
          if (cols.length < 5) continue;
          const paperLink = cols[4];
          if (existingLinks.has(paperLink)) continue;

          newDatasets.push({
            id: `imported-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
            title: cols[0],
            source: (cols[1] as any) || 'Other',
            authors: cols[2].split(',').map(a => a.trim()).filter(a => a),
            year: cols[3],
            paperLink: paperLink,
            githubLink: cols[5] || undefined,
            itemCount: cols[6],
            specs: cols[7],
            description: cols[8]
          });
        }

        if (newDatasets.length > 0) {
          setSavedDatasets(prev => [...prev, ...newDatasets]);
          alert(`Imported ${newDatasets.length} benchmarks.`);
        }
      } catch (err) {
        alert("Failed to parse CSV.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        
        if (!Array.isArray(data)) {
          alert("Invalid JSON format. Expected an array of datasets.");
          return;
        }

        const newDatasets: BenchmarkDataset[] = [];
        const existingLinks = new Set(savedDatasets.map(d => d.paperLink));

        data.forEach((item: any, index: number) => {
          if (!item.title || !item.paperLink) return;
          if (existingLinks.has(item.paperLink)) return;

          newDatasets.push({
            ...item,
            id: `imported-json-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 5)}`
          });
        });

        if (newDatasets.length > 0) {
          setSavedDatasets(prev => [...prev, ...newDatasets]);
          alert(`Imported ${newDatasets.length} benchmarks from JSON.`);
        } else {
          alert("No new datasets found in the JSON file.");
        }
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCancelSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    setSearchState(prev => ({
      ...prev,
      isSearching: false,
      status: 'Search cancelled by user',
      progress: 0
    }));
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const activeQuery = overrideQuery !== undefined ? overrideQuery : query;
    if (!activeQuery.trim()) return;

    if (overrideQuery !== undefined) setQuery(overrideQuery);
    setSearchHistory(prev => [activeQuery, ...prev.filter(q => q !== activeQuery)].slice(0, MAX_HISTORY_ITEMS));

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setSearchState({ isSearching: true, results: [], error: undefined, progress: 5, status: SEARCH_STATUSES[0] });
    setActiveTab('discover');
    setSourceFilter('All');
    
    progressInterval.current = window.setInterval(() => {
      setSearchState(prev => {
        if (!prev.isSearching) return prev;
        const nextProgress = Math.min(prev.progress + 2, 95);
        const statusIdx = Math.min(Math.floor((nextProgress / 100) * SEARCH_STATUSES.length), SEARCH_STATUSES.length - 1);
        return { ...prev, progress: nextProgress, status: SEARCH_STATUSES[statusIdx] };
      });
    }, 800);

    try {
      const results = await searchBenchmarkDatasets(activeQuery, settings.model);
      if (progressInterval.current) clearInterval(progressInterval.current);
      setSearchState({ isSearching: false, results, progress: 100, status: 'Complete' });
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      if (progressInterval.current) clearInterval(progressInterval.current);
      setSearchState({ isSearching: false, results: [], error: error.message, progress: 0, status: '' });
    }
  };

  const handleSave = useCallback((dataset: BenchmarkDataset) => {
    setSavedDatasets(prev => {
      if (prev.find(d => d.paperLink === dataset.paperLink)) return prev;
      return [...prev, { ...dataset, id: `saved-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` }];
    });
  }, []);

  const handleRemove = useCallback((id: string) => {
    setSavedDatasets(prev => prev.filter(d => d.id !== id));
    setCustomLists(prev => prev.map(l => ({ ...l, datasetIds: l.datasetIds.filter(did => did !== id) })));
  }, []);

  const toggleDatasetInList = (datasetId: string, listId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomLists(prev => prev.map(list => {
      if (list.id === listId) {
        const has = list.datasetIds.includes(datasetId);
        return {
          ...list,
          datasetIds: has ? list.datasetIds.filter(id => id !== datasetId) : [...list.datasetIds, datasetId]
        };
      }
      return list;
    }));
  };

  const toggleComparison = useCallback((link: string) => {
    setSelectedForComparisonLinks(prev => 
      prev.includes(link) ? prev.filter(l => l !== link) : [...prev, link]
    );
  }, []);

  const filteredAndSorted = useCallback((items: BenchmarkDataset[]) => {
    let result = [...items];
    if (filterQuery.trim()) {
      const lq = filterQuery.toLowerCase();
      result = result.filter(d => [d.title, d.description].join(' ').toLowerCase().includes(lq));
    }
    return result.sort((a, b) => {
      const va = (a[sortConfig.field] || '').toString().toLowerCase();
      const vb = (b[sortConfig.field] || '').toString().toLowerCase();
      return sortConfig.order === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [filterQuery, sortConfig]);

  const displayItems = useMemo(() => {
    let items: BenchmarkDataset[] = [];
    if (activeTab === 'discover') {
        items = searchState.results;
    } else if (activeTab === 'recommend') {
        items = recommendedDatasets;
    } else if (activeListId === 'all') {
        items = savedDatasets;
    } else {
        const activeList = customLists.find(l => l.id === activeListId);
        items = activeList ? savedDatasets.filter(d => activeList.datasetIds.includes(d.id)) : [];
    }

    if (activeTab === 'discover' && sourceFilter !== 'All') {
        items = items.filter(d => d.source === sourceFilter);
    }

    return filteredAndSorted(items);
  }, [activeTab, activeListId, savedDatasets, recommendedDatasets, searchState.results, sourceFilter, filteredAndSorted]);

  const allAvailableDatasetsByLink = useMemo(() => {
    const map = new Map<string, BenchmarkDataset>();
    [...recommendedDatasets, ...searchState.results, ...savedDatasets].forEach(d => {
      map.set(d.paperLink, d);
    });
    return map;
  }, [savedDatasets, recommendedDatasets, searchState.results]);

  const comparisonItems = useMemo(() => {
    return selectedForComparisonLinks
      .map(link => allAvailableDatasetsByLink.get(link))
      .filter((d): d is BenchmarkDataset => !!d);
  }, [selectedForComparisonLinks, allAvailableDatasetsByLink]);

  const isSaved = (link: string) => savedDatasets.some(d => d.paperLink === link);

  const handleSaveSelected = () => {
    const visibleSelectedItems = displayItems.filter(item => selectedForComparisonLinks.includes(item.paperLink));
    visibleSelectedItems.forEach(item => handleSave(item));
    if (activeTab !== 'saved') {
        setSelectedForComparisonLinks(prev => prev.filter(link => !displayItems.some(di => di.paperLink === link)));
    }
  };

  const toggleSelectAllVisible = () => {
    const allVisibleLinks = displayItems.map(d => d.paperLink);
    const areAllSelected = allVisibleLinks.length > 0 && allVisibleLinks.every(link => selectedForComparisonLinks.includes(link));
    
    if (areAllSelected) {
      setSelectedForComparisonLinks(prev => prev.filter(link => !allVisibleLinks.includes(link)));
    } else {
      setSelectedForComparisonLinks(prev => {
        const newSet = new Set([...prev, ...allVisibleLinks]);
        return Array.from(newSet);
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">BenchmarkHub</span>
          </div>

          <div className="flex items-center gap-4">
            <nav className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => { setActiveTab('saved'); setFilterQuery(''); }} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'saved' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>My Library</button>
              <button onClick={() => { setActiveTab('recommend'); setFilterQuery(''); }} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'recommend' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Recommend</button>
              <button onClick={() => { setActiveTab('discover'); setFilterQuery(''); }} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'discover' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Discover</button>
            </nav>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
        {activeTab === 'saved' ? (
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="w-full lg:w-64 flex-shrink-0">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Collections</h3>
                <nav className="space-y-1">
                  <button 
                    onClick={() => setActiveListId('all')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeListId === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                      All Saved
                    </span>
                    <span className="text-xs opacity-60">{savedDatasets.length}</span>
                  </button>
                  {customLists.map(list => (
                    <button 
                      key={list.id}
                      onClick={() => setActiveListId(list.id)}
                      className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeListId === list.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        {list.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs opacity-60">{list.datasetIds.length}</span>
                        <div onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this collection?")) {
                            setCustomLists(prev => prev.filter(l => l.id !== list.id));
                            if (activeListId === list.id) setActiveListId('all');
                          }
                        }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 transition-all"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></div>
                      </div>
                    </button>
                  ))}
                </nav>
                <button 
                  onClick={() => {
                    const name = prompt("Enter the name for your new collection:");
                    if (!name) return;
                    setCustomLists(prev => [...prev, { id: `list-${Date.now()}`, name, datasetIds: [], createdAt: Date.now() }]);
                  }} 
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm font-bold hover:border-indigo-300 hover:text-indigo-600 transition-all bg-slate-50/50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  New Collection
                </button>

                <div className="mt-8 pt-4 border-t border-slate-100 space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">Library Tools</h3>
                  <div className="grid grid-cols-1 gap-1">
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Import CSV
                    </button>
                    <button 
                      onClick={() => jsonFileInputRef.current?.click()} 
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Import JSON
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".csv" />
                    <input type="file" ref={jsonFileInputRef} onChange={handleImportJSON} className="hidden" accept=".json" />
                    
                    <button 
                      onClick={handleExport} 
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Export CSV
                    </button>
                    <button 
                      onClick={handleExportJSON} 
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Export JSON
                    </button>

                    <button 
                      onClick={handleResetLibrary} 
                      className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-tight transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Clear All Data
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex-grow">
              <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">{activeListId === 'all' ? 'My Library' : customLists.find(l => l.id === activeListId)?.name}</h2>
                  <p className="text-sm text-slate-500">{displayItems.length} benchmarks in this collection</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <input type="text" placeholder="Filter benchmarks..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm w-48 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} />
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0">
                    <button 
                      onClick={() => setSortConfig(prev => ({ field: 'title', order: prev.field === 'title' && prev.order === 'asc' ? 'desc' : 'asc' }))}
                      title="Sort by Name"
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${sortConfig.field === 'title' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Name {sortConfig.field === 'title' && (sortConfig.order === 'asc' ? '↑' : '↓')}
                    </button>
                    <button 
                      onClick={() => setSortConfig(prev => ({ field: 'year', order: prev.field === 'year' && prev.order === 'desc' ? 'asc' : 'desc' }))}
                      title="Sort by Year"
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${sortConfig.field === 'year' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Year {sortConfig.field === 'year' && (sortConfig.order === 'desc' ? '↓' : '↑')}
                    </button>
                  </div>

                  <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm shrink-0">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2h-2a2 2 0 01-2-2v-2z" /></svg></button>
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                  </div>
                </div>
              </div>

              {displayItems.length > 0 ? (
                <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-6`}>
                  {displayItems.map(dataset => (
                    <div key={dataset.id} className="relative group/card">
                      <DatasetCard 
                        dataset={dataset} 
                        onRemove={handleRemove} 
                        isSaved={true} 
                        viewMode={viewMode}
                        showSelection={true}
                        isSelected={selectedForComparisonLinks.includes(dataset.paperLink)}
                        onToggleSelect={toggleComparison}
                      />
                      <div className="absolute top-3 right-12 opacity-0 group-hover/card:opacity-100 transition-opacity z-10">
                        <div className="relative inline-block text-left group/dropdown">
                          <button className="bg-white p-2 rounded-full shadow-lg border border-slate-200 hover:bg-slate-50 transition-all">
                            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                          </button>
                          <div className="hidden group-focus-within/dropdown:block absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                             <div className="text-[9px] font-bold text-slate-400 uppercase p-2 border-b border-slate-100 mb-1">Add to Collection</div>
                             {customLists.map(cl => (
                               <button 
                                 key={cl.id}
                                 onClick={(e) => toggleDatasetInList(dataset.id, cl.id, e)}
                                 className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-indigo-50 rounded-lg flex items-center justify-between transition-colors"
                               >
                                 {cl.name}
                                 {cl.datasetIds.includes(dataset.id) && <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                               </button>
                             ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-32 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 font-medium">No benchmarks here. Try finding some in Discover.</div>
              )}
            </div>
          </div>
        ) : activeTab === 'recommend' ? (
          <div className="max-w-7xl mx-auto">
            <div className="mb-12 text-center">
              <h2 className="text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">Curated Recommendations</h2>
              <p className="text-slate-500 text-lg">Essential benchmarks derived from standard academic sources.</p>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xl mb-6 flex flex-col md:flex-row items-center gap-4">
              <div className="relative flex-grow w-full md:w-auto">
                <input 
                  type="text" 
                  placeholder="Search curated list..." 
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                  value={filterQuery} 
                  onChange={(e) => setFilterQuery(e.target.value)} 
                />
                <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200 shrink-0">
                  <button 
                    onClick={() => setSortConfig(prev => ({ field: 'title', order: prev.field === 'title' && prev.order === 'asc' ? 'desc' : 'asc' }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${sortConfig.field === 'title' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Name
                    {sortConfig.field === 'title' && (sortConfig.order === 'asc' ? '↑' : '↓')}
                  </button>
                  <button 
                    onClick={() => setSortConfig(prev => ({ field: 'year', order: prev.field === 'year' && prev.order === 'desc' ? 'asc' : 'desc' }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${sortConfig.field === 'year' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Year
                    {sortConfig.field === 'year' && (sortConfig.order === 'desc' ? '↓' : '↑')}
                  </button>
                </div>

                <div className="h-8 w-px bg-slate-200 mx-1 shrink-0"></div>

                <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200 shrink-0">
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2h-2a2 2 0 01-2-2v-2z" /></svg>
                  </button>
                  <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-4 mb-8 px-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                   <button 
                    onClick={toggleSelectAllVisible}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      displayItems.length > 0 && displayItems.every(d => selectedForComparisonLinks.includes(d.paperLink))
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                    }`}
                   >
                     <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                       displayItems.length > 0 && displayItems.every(d => selectedForComparisonLinks.includes(d.paperLink))
                         ? 'bg-white border-white text-indigo-600'
                         : 'bg-transparent border-slate-300 text-transparent'
                     }`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                     </div>
                     {displayItems.length > 0 && displayItems.every(d => selectedForComparisonLinks.includes(d.paperLink)) ? 'Unselect All' : 'Select All'}
                   </button>
                </div>
                <div className="text-sm font-medium text-slate-500">
                  Showing <span className="font-extrabold text-indigo-600">{displayItems.length}</span> curated benchmarks
                </div>
              </div>

              {displayItems.some(item => selectedForComparisonLinks.includes(item.paperLink)) && (
                <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                  <span className="text-xs font-bold text-slate-400 mr-2 uppercase">Bulk Actions:</span>
                  <button 
                    onClick={handleSaveSelected}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                    Add {displayItems.filter(i => selectedForComparisonLinks.includes(i.paperLink)).length} to My Library
                  </button>
                  <button 
                    onClick={() => setSelectedForComparisonLinks(prev => prev.filter(link => !displayItems.some(di => di.paperLink === link)))}
                    className="px-4 py-2.5 text-slate-400 hover:text-red-500 text-xs font-bold transition-colors"
                  >
                    Cancel Selection
                  </button>
                </div>
              )}
            </div>
            
            <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
              {displayItems.length > 0 ? (
                displayItems.map(dataset => (
                  <DatasetCard 
                    key={dataset.id} 
                    dataset={dataset} 
                    onSave={handleSave} 
                    isSaved={isSaved(dataset.paperLink)} 
                    viewMode={viewMode}
                    showSelection={true}
                    isSelected={selectedForComparisonLinks.includes(dataset.paperLink)}
                    onToggleSelect={toggleComparison}
                  />
                ))
              ) : (
                <div className="col-span-full py-32 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 font-medium">
                  No matches for "{filterQuery}" in recommendations.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Discover Benchmarks</h2>
              <p className="text-slate-500 text-lg">Harness Gemini AI to search across arXiv and Hugging Face.</p>
            </div>

            <form onSubmit={handleSearch} className="relative mb-6">
              <input type="text" className="w-full pl-14 pr-32 py-5 bg-white border-2 border-slate-200 rounded-3xl shadow-xl focus:border-indigo-500 outline-none text-xl transition-all" placeholder="e.g. MedMNIST, LLM Reasoning, ChartQA..." value={query} onChange={(e) => setQuery(e.target.value)} disabled={searchState.isSearching} />
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" x2="16.65" y1="21" y2="16.65"></line></svg></div>
              <button type="submit" disabled={searchState.isSearching || !query.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100 transition-all">{searchState.isSearching ? 'Searching...' : 'Search'}</button>
            </form>

            <div className="mb-10 flex flex-wrap gap-2 justify-center items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Filter Source:</span>
              {SOURCES.map(src => (
                <button
                  key={src}
                  onClick={() => setSourceFilter(src)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    sourceFilter === src 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>

            {searchState.isSearching ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center px-2">
                  <span className="text-sm font-bold text-slate-600">{searchState.status}</span>
                  <span className="text-sm font-extrabold text-indigo-600">{Math.round(searchState.progress)}%</span>
                </div>
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden shadow-inner"><div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${searchState.progress}%` }}></div></div>
                <div className="flex justify-center">
                  <button 
                    onClick={handleCancelSearch}
                    className="flex items-center gap-2 px-6 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 hover:bg-red-100 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    Stop Search
                  </button>
                </div>
              </div>
            ) : (
              <>
                {displayItems.length > 0 && (
                  <div className="flex flex-wrap justify-between items-center gap-4 mb-8 px-2">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={toggleSelectAllVisible}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                          displayItems.length > 0 && displayItems.every(d => selectedForComparisonLinks.includes(d.paperLink))
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          displayItems.length > 0 && displayItems.every(d => selectedForComparisonLinks.includes(d.paperLink))
                            ? 'bg-white border-white text-indigo-600'
                            : 'bg-transparent border-slate-300 text-transparent'
                        }`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        {displayItems.length > 0 && displayItems.every(d => selectedForComparisonLinks.includes(d.paperLink)) ? 'Unselect All' : 'Select All Search Results'}
                      </button>
                    </div>

                    {displayItems.some(item => selectedForComparisonLinks.includes(item.paperLink)) && (
                      <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                        <span className="text-xs font-bold text-slate-400 mr-2 uppercase">Bulk Actions:</span>
                        <button 
                          onClick={handleSaveSelected}
                          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                          Add {displayItems.filter(i => selectedForComparisonLinks.includes(i.paperLink)).length} to My Library
                        </button>
                        <button 
                          onClick={() => setSelectedForComparisonLinks(prev => prev.filter(link => !displayItems.some(di => di.paperLink === link)))}
                          className="px-4 py-2.5 text-slate-400 hover:text-red-500 text-xs font-bold transition-colors"
                        >
                          Cancel Selection
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {displayItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {displayItems.map(dataset => (
                      <DatasetCard 
                        key={dataset.id} 
                        dataset={dataset} 
                        onSave={handleSave} 
                        isSaved={isSaved(dataset.paperLink)} 
                        showSelection={true}
                        isSelected={selectedForComparisonLinks.includes(dataset.paperLink)}
                        onToggleSelect={toggleComparison}
                      />
                    ))}
                  </div>
                ) : query && !searchState.isSearching && (
                   <div className="text-center py-20 text-slate-400 italic">No results found matching your search and filter.</div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {selectedForComparisonLinks.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 group">
           <div className="bg-white/80 backdrop-blur-xl border border-indigo-200 p-2 rounded-full shadow-2xl flex items-center gap-2 pr-4 transition-all hover:pr-2">
             <div className="flex -space-x-3 ml-2 overflow-hidden py-1">
                {comparisonItems.slice(0, 3).map(item => (
                  <div key={item.id} className="w-8 h-8 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold uppercase shadow-sm">
                    {item.title[0]}
                  </div>
                ))}
                {comparisonItems.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-slate-400 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                    +{comparisonItems.length - 3}
                  </div>
                )}
             </div>
             <button 
                onClick={() => setIsComparing(true)} 
                disabled={comparisonItems.length < 2}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-full font-bold text-sm shadow-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center gap-2"
              >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
               {comparisonItems.length < 2 ? `Select ${2 - comparisonItems.length} more` : `Compare (${comparisonItems.length})`}
             </button>
             <button 
               onClick={() => setSelectedForComparisonLinks([])}
               className="p-2.5 text-slate-400 hover:text-red-500 transition-colors"
               title="Clear selection"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
             </button>
           </div>
        </div>
      )}

      {isComparing && (
        <ComparisonModal 
          datasets={comparisonItems} 
          filterQuery={filterQuery} 
          onClose={() => setIsComparing(false)} 
        />
      )}
      {isSettingsOpen && <SettingsModal settings={settings} onUpdate={setSettings} onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
};

export default App;