
import React from 'react';
import { BenchmarkDataset } from '../types';

interface ComparisonModalProps {
  datasets: BenchmarkDataset[];
  filterQuery: string;
  onClose: () => void;
}

const HighlightedText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim()) return <span>{text}</span>;

  const regex = new RegExp(`(${query})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-indigo-100 text-indigo-700 rounded-sm font-bold px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

const ComparisonModal: React.FC<ComparisonModalProps> = ({ datasets, filterQuery, onClose }) => {
  if (datasets.length === 0) return null;

  const features = [
    { label: 'Source', key: 'source' },
    { label: 'Year', key: 'year' },
    { label: 'Authors', key: 'authors', formatter: (val: string[]) => val?.join(', ') || 'N/A' },
    { label: 'Size', key: 'itemCount' },
    { label: 'Specs/Format', key: 'specs' },
    { label: 'Description', key: 'description', highlight: true },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Benchmark Comparison</h2>
            <p className="text-sm text-slate-500">Comparing {datasets.length} selected datasets</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable Table Area */}
        <div className="flex-grow overflow-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 bg-slate-50 p-4 text-left font-bold text-slate-900 border-r border-slate-200 w-48 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Feature</th>
                {datasets.map(d => (
                  <th key={d.id} className="p-4 text-left min-w-[300px] align-top">
                    <div className="text-slate-900 font-bold text-sm leading-tight line-clamp-2 mb-2">
                      <HighlightedText text={d.title} query={filterQuery} />
                    </div>
                    <div className="flex gap-2">
                       <a href={d.paperLink} target="_blank" rel="noreferrer" className="text-[10px] bg-slate-900 text-white px-2 py-1 rounded hover:bg-slate-800">Paper</a>
                       {d.githubLink && <a href={d.githubLink} target="_blank" rel="noreferrer" className="text-[10px] border border-slate-300 px-2 py-1 rounded hover:bg-slate-50">GitHub</a>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {features.map((feature, idx) => (
                <tr key={feature.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="sticky left-0 p-4 font-semibold text-slate-700 bg-inherit border-r border-slate-200 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    {feature.label}
                  </td>
                  {datasets.map(d => {
                    const val = (d as any)[feature.key];
                    let content: React.ReactNode;
                    
                    if (feature.highlight && typeof val === 'string') {
                      content = <HighlightedText text={val} query={filterQuery} />;
                    } else if (feature.formatter) {
                      content = feature.formatter(val);
                    } else {
                      content = val || 'N/A';
                    }

                    return (
                      <td key={d.id} className="p-4 text-sm text-slate-600 align-top">
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {content}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-200 text-right bg-slate-50">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComparisonModal;
