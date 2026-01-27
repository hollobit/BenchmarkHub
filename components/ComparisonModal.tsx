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
    { label: 'Academic Source', key: 'source', taggable: true },
    { label: 'Year', key: 'year' },
    { label: 'Lead Authors', key: 'authors', formatter: (val: string[]) => val?.join(', ') || 'N/A' },
    { label: 'Dataset Size', key: 'itemCount', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { label: 'Specs / Modalities', key: 'specs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'Methodology & Purpose', key: 'description', highlight: true },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Side-by-Side Comparison</h2>
            </div>
            <p className="text-sm font-medium text-slate-500">Evaluating {datasets.length} selected benchmarks for your research.</p>
          </div>
          <button 
            onClick={onClose}
            className="group p-3 bg-slate-50 hover:bg-red-50 rounded-2xl transition-all"
          >
            <svg className="w-6 h-6 text-slate-400 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Responsive Comparison Grid */}
        <div className="flex-grow overflow-auto bg-slate-50/30">
          <table className="w-full border-separate border-spacing-0 min-w-[900px]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 bg-white p-6 text-left border-b border-r border-slate-100 w-64 z-30 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.05)]">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Feature Matrix</span>
                </th>
                {datasets.map(d => (
                  <th key={d.id} className="sticky top-0 p-6 text-left min-w-[320px] bg-white border-b border-slate-100 align-top z-20">
                    <div className="flex flex-col h-full">
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-1 rounded-lg w-fit mb-3 ${
                        d.source === 'arXiv' ? 'bg-red-50 text-red-600' :
                        d.source === 'Hugging Face' ? 'bg-yellow-50 text-yellow-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {d.source}
                      </span>
                      <h3 className="text-lg font-extrabold text-slate-900 leading-tight mb-4 min-h-[3rem] line-clamp-2">
                        <HighlightedText text={d.title} query={filterQuery} />
                      </h3>
                      <div className="flex gap-2 mt-auto">
                        <a 
                          href={d.paperLink} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex-1 text-center py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 hover:shadow-lg transition-all"
                        >
                          View Paper
                        </a>
                        {d.githubLink && (
                          <a 
                            href={d.githubLink} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="p-2.5 border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-slate-700"
                            title="Open Repository"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                          </a>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {features.map((feature, idx) => (
                <tr key={feature.label} className="group hover:bg-indigo-50/20 transition-colors">
                  <td className="sticky left-0 p-6 bg-white group-hover:bg-slate-50 border-r border-slate-100 z-10 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.03)] transition-colors">
                    <div className="flex items-center gap-3">
                      {feature.icon && (
                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={feature.icon} />
                          </svg>
                        </div>
                      )}
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{feature.label}</span>
                    </div>
                  </td>
                  {datasets.map(d => {
                    const val = (d as any)[feature.key];
                    let content: React.ReactNode;
                    
                    if (feature.highlight && typeof val === 'string') {
                      content = <HighlightedText text={val} query={filterQuery} />;
                    } else if (feature.formatter) {
                      content = feature.formatter(val);
                    } else if (feature.taggable) {
                      content = (
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                          {val}
                        </span>
                      );
                    } else {
                      content = val || <span className="text-slate-300 italic">Not specified</span>;
                    }

                    return (
                      <td key={d.id} className="p-6 text-sm text-slate-600 align-top">
                        <div className={`whitespace-pre-wrap leading-relaxed ${feature.highlight ? 'text-slate-600 font-medium' : 'text-slate-500'}`}>
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
        <div className="p-6 border-t border-slate-100 text-right bg-white flex justify-between items-center px-8">
          <div className="text-xs font-medium text-slate-400">
            Export or Print functionality coming soon.
          </div>
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-200"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComparisonModal;