
import React from 'react';
import { BenchmarkDataset, ViewMode } from '../types';

interface DatasetCardProps {
  dataset: BenchmarkDataset;
  onSave?: (dataset: BenchmarkDataset) => void;
  onRemove?: (id: string) => void;
  isSaved?: boolean;
  viewMode?: ViewMode;
  onToggleSelect?: (id: string) => void;
  isSelected?: boolean;
  showSelection?: boolean;
}

const DatasetCard: React.FC<DatasetCardProps> = ({ 
  dataset, onSave, onRemove, isSaved, viewMode = 'grid', 
  onToggleSelect, isSelected, showSelection 
}) => {
  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaved) {
      onRemove?.(dataset.id);
    } else {
      onSave?.(dataset);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    if (showSelection && onToggleSelect) {
      onToggleSelect(dataset.id);
    }
  };

  const SelectionOverlay = () => {
    if (!showSelection) return null;
    return (
      <div 
        className={`absolute top-3 left-3 z-20 cursor-pointer p-1 rounded-md border-2 transition-all ${
          isSelected 
            ? 'bg-indigo-600 border-indigo-600 text-white' 
            : 'bg-white/80 border-slate-300 text-transparent hover:border-indigo-400'
        }`}
        onClick={(e) => { e.stopPropagation(); onToggleSelect?.(dataset.id); }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  };

  if (viewMode === 'list') {
    return (
      <div 
        onClick={handleToggle}
        className={`relative bg-white border rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-4 transition-all ${
          isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10' : 'border-slate-200 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-3 flex-shrink-0">
          {showSelection && (
             <div 
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'
              }`}
             >
               {isSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
             </div>
          )}
          <div className="w-24">
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
              dataset.source === 'arXiv' ? 'bg-red-100 text-red-700' :
              dataset.source === 'Hugging Face' ? 'bg-yellow-100 text-yellow-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {dataset.source}
            </span>
          </div>
        </div>
        
        <div className="flex-grow min-w-0">
          <h3 className="text-sm font-bold text-slate-900 truncate" title={dataset.title}>
            {dataset.title}
          </h3>
          <p className="text-xs text-slate-500 truncate">
            {dataset.authors?.join(', ')} {dataset.year ? `· ${dataset.year}` : ''}
          </p>
        </div>

        <div className="flex-shrink-0 flex items-center gap-4 text-xs text-slate-500">
          <div className="hidden lg:block w-32 truncate">
            <span className="font-semibold">Size:</span> {dataset.itemCount || 'N/A'}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          <a
            href={dataset.paperLink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
            onClick={(e) => e.stopPropagation()}
            title="View Paper"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </a>
          <button
            onClick={handleAction}
            className={`p-2 rounded-lg transition-colors ${
              isSaved ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-slate-400 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            {isSaved ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={handleToggle}
      className={`relative bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all p-6 flex flex-col h-full cursor-default ${
        isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
      }`}
    >
      <SelectionOverlay />
      <div className="flex justify-between items-start mb-4">
        <div className={showSelection ? 'ml-8' : ''}>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            dataset.source === 'arXiv' ? 'bg-red-100 text-red-700' :
            dataset.source === 'Hugging Face' ? 'bg-yellow-100 text-yellow-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {dataset.source}
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-2 leading-tight line-clamp-2">
            {dataset.title}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {dataset.authors?.join(', ')} {dataset.year ? `· ${dataset.year}` : ''}
          </p>
        </div>
        <button
          onClick={handleAction}
          className={`p-2 rounded-full transition-colors flex-shrink-0 ${
            isSaved ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-slate-400 bg-slate-50 hover:bg-slate-100'
          }`}
          title={isSaved ? "Remove from Library" : "Save to Library"}
        >
          {isSaved ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          )}
        </button>
      </div>

      <p className="text-slate-600 text-sm mb-4 line-clamp-3 flex-grow">
        {dataset.description}
      </p>

      <div className="space-y-3 pt-4 border-t border-slate-100">
        <div className="flex items-center text-sm text-slate-700">
          <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <span className="font-medium">Size:</span>
          <span className="ml-2 truncate">{dataset.itemCount || 'N/A'}</span>
        </div>
        <div className="flex items-center text-sm text-slate-700">
          <svg className="w-4 h-4 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span className="font-medium">Format:</span>
          <span className="ml-2 truncate">{dataset.specs || 'N/A'}</span>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <a
          href={dataset.paperLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-center bg-slate-900 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors"
        >
          View Paper
        </a>
        {dataset.githubLink && (
          <a
            href={dataset.githubLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center w-10 h-10 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          </a>
        )}
      </div>
    </div>
  );
};

export default DatasetCard;
