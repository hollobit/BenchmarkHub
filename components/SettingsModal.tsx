
import React from 'react';
import { AppSettings, GeminiModel } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onUpdate, onClose }) => {
  const handleModelChange = (model: GeminiModel) => {
    onUpdate({ ...settings, model });
  };

  const handleOpenKeyPicker = async () => {
    try {
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.openSelectKey === 'function') {
        await aistudio.openSelectKey();
        // After triggering the picker, we assume the user will handle it in the system dialog
        onClose();
      } else {
        alert("API Key selection is not available in this environment.");
      }
    } catch (err) {
      console.error("Error opening API key picker:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">App Configuration</h2>
            <p className="text-xs text-slate-500">Manage your API and Model preferences</p>
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

        <div className="p-6 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Secure API Key</h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">ENCRYPTED</span>
            </div>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              Gemini API keys are managed via the secure platform dialog. This ensures your keys are never stored in plain text and stay connected to your paid GCP projects.
            </p>
            <button
              onClick={handleOpenKeyPicker}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Switch or Setup API Key
            </button>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
               <p className="text-[11px] text-blue-700 flex gap-2">
                 <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path></svg>
                 To use Search Grounding and Pro models, ensure your selected key is from a project with billing enabled.
               </p>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Gemini Intelligence Model</h3>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: 'Complex reasoning & deep analysis', tag: 'High Precision' },
                { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Fast, balanced performance', tag: 'Fast' },
                { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', desc: 'Lowest latency for basic tasks', tag: 'Lite' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModelChange(m.id as GeminiModel)}
                  className={`w-full flex flex-col p-4 rounded-xl border-2 transition-all text-left relative ${
                    settings.model === m.id 
                      ? 'border-indigo-600 bg-indigo-50/30' 
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-bold text-sm ${settings.model === m.id ? 'text-indigo-900' : 'text-slate-900'}`}>{m.name}</span>
                    <span className="text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{m.tag}</span>
                  </div>
                  <span className="text-xs text-slate-500 leading-tight">{m.desc}</span>
                  {settings.model === m.id && (
                    <div className="absolute top-2 right-2 -mt-4 -mr-1">
                       <div className="bg-indigo-600 rounded-full p-1 border-2 border-white shadow-sm">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                       </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-grow py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
