'use client';

import React, { useState } from 'react';

interface DirectoryTree {
  [key: string]: string[];
}

interface Dependency {
  source: string;
  target: string;
  type: string;
}

interface AnalysisResult {
  directory_tree: DirectoryTree;
  dependencies: Dependency[];
}

export default function Home() {
  const [targetPath, setTargetPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [readmeLoading, setReadmeLoading] = useState(false);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [readme, setReadme] = useState<string>('');
  const [error, setError] = useState('');

  const triggerAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPath.trim()) return;

    setLoading(true);
    setError('');
    setData(null);
    setReadme('');

    try {
      const response = await fetch('/api/analyze-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath.trim() }),
      });

      if (!response.ok) throw new Error('Failed to parse folder architecture structure.');
      const result: AnalysisResult = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Error connecting to the application data backend.');
    } finally {
      setLoading(false);
    }
  };

  const generateOnboardingGuide = async () => {
    if (!targetPath.trim()) return;
    setReadmeLoading(true);
    try {
      const response = await fetch('/api/generate-readme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath.trim() }),
      });
      if (!response.ok) throw new Error('Failed to generate documentation.');
      const result = await response.json();
      setReadme(result.markdown);
    } catch (err: any) {
      console.error(err);
    } finally {
      setReadmeLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="border-b border-slate-800 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-indigo-400">CodeMap AI</h1>
            <p className="text-sm text-slate-400 mt-1">Autonomous Developer Onboarding Platform • Powered by IBM Bob 2.0</p>
          </div>
          <span className="px-3 py-1 text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
            System Operational
          </span>
        </header>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <form onSubmit={triggerAnalysis} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-300">Target Codebase Folder Path:</label>
            <div className="flex gap-4">
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="e.g., D:\IBM HACKATHON"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium px-6 py-2 rounded-lg transition-colors"
              >
                {loading ? 'Mapping Repository Layout...' : 'Map Repository'}
              </button>
            </div>
          </form>
          {error && <p className="text-sm text-rose-400 mt-3 font-medium">⚠️ {error}</p>}
        </section>

        {data && (
          <div className="space-y-8">
            <div className="flex justify-end">
              <button
                onClick={generateOnboardingGuide}
                disabled={readmeLoading}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition-all shadow-lg"
              >
                {readmeLoading ? 'Synthesizing Documentation...' : '⚡ Generate AI Onboarding Guide'}
              </button>
            </div>

            {readme && (
              <section className="bg-slate-900 border border-emerald-800/40 rounded-xl p-6 shadow-2xl space-y-4 bg-gradient-to-b from-slate-900 to-slate-950">
                <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">📖 Generated System Onboarding Document</h2>
                <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-300">
                  {readme}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <section className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
                <h2 className="text-lg font-bold text-slate-200">📁 Project File Visualizations</h2>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {Object.keys(data.directory_tree).map((folder) => (
                    <div key={folder} className="bg-slate-950 p-4 rounded-lg border border-slate-800/60 text-xs">
                      <span className="text-indigo-400 font-bold block mb-2">📂 {folder}</span>
                      <ul className="grid grid-cols-2 gap-2 pl-4 text-slate-400">
                        {data.directory_tree[folder].map((file) => <li key={file} className="truncate">📄 {file}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
                <h2 className="text-lg font-bold text-slate-200">🔗 Module Dependencies</h2>
                <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3">
                  {data.dependencies.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No structural cross-file imports detected.</p>
                  ) : (
                    data.dependencies.map((dep, idx) => (
                      <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-[11px] flex flex-col gap-1">
                        <div className="flex justify-between items-center text-slate-400">
                          <span className="text-emerald-400 truncate">{dep.source}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900 border border-slate-800">{dep.type}</span>
                        </div>
                        <span className="text-slate-500 text-center text-[10px]">⬇️ maps to</span>
                        <span className="text-indigo-400 truncate font-semibold">📦 {dep.target}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
