
import React from 'react';
import { AppSettings, GeminiModel } from '../types';

interface SettingsModalProps {
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  onClose: () => void;
}

// Removed conflicting declare global block for Window.aistudio.
// AIStudio type is assumed to be provided by the environment.

const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onUpdate, onClose }) => {
  const handleModelChange = (model: GeminiModel) => {
    onUpdate({ ...settings, model });
  };

  const handleOpenKeyPicker = async () => {
    try {
      // Use type assertion to access global aistudio safely and avoid redeclaration errors.
      const aistudio = (window as any).aistudio;
      if (aistudio && typeof aistudio.openSelectKey === 'function') {
        await aistudio.openSelectKey();
        // As per guidelines, assume success after triggering and proceed immediately.
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
          <h2 className="text-xl font-bold text-slate-900">Configuration</h2>
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
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">API Key</h3>
            <p className="text-sm text-slate-500 mb-4">
              Connect your Google AI Studio API key to enable search features.
            </p>
            <button
              onClick={handleOpenKeyPicker}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Select API Key
            </button>
            <p className="mt-3 text-center text-xs text-slate-400">
              Go to <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Billing Docs</a> for more info.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Model Selection</h3>
            <div className="space-y-2">
              {[
                { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: 'Best for complex reasoning' },
                { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Fast and lightweight' },
                { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', desc: 'Highly optimized' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModelChange(m.id as GeminiModel)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    settings.model === m.id 
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900' 
                      : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-bold text-sm">{m.name}</div>
                    <div className="text-xs opacity-70">{m.desc}</div>
                  </div>
                  {settings.model === m.id && (
                    <div className="bg-indigo-600 rounded-full p-1">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
