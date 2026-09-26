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
  project_metadata: { name: string; detected_services: number };
  directory_tree: DirectoryTree;
  dependencies: Dependency[];
}

export default function Home() {
  const [targetPath, setTargetPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState('');

  const scanAccessRequirements = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPath.trim()) return;

    setLoading(true);
    setError('');
    setData(null);
    setLogs([]);

    try {
      const response = await fetch('/api/analyze-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_path: targetPath.trim() }),
      });

      if (!response.ok) throw new Error('Failed to analyze environment credentials.');
      const result: AnalysisResult = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Error connecting to TokenFlow core service.');
    } finally {
      setLoading(false);
    }
  };

  const triggerSandboxProvisioning = async () => {
    if (!targetPath.trim()) return;
    setProvisioning(true);
    try {
      const response = await fetch('/api/provision-sandboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_path: targetPath.trim() }),
      });
      if (!response.ok) throw new Error('Provisioning cycle interrupted.');
      const result = await response.json();
      setLogs(result.logs);
    } catch (err: any) {
      console.error(err);
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="border-b border-slate-800 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400">TokenFlow AI</h1>
            <p className="text-sm text-slate-400 mt-1">Autonomous Developer Access & Sandbox Provisioning Platform • Powered by IBM Bob 2.0</p>
          </div>
          <span className="px-3 py-1 text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
            SecOps Core Online
          </span>
        </header>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <form onSubmit={scanAccessRequirements} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-300">Target Enterprise Project Repository Path:</label>
            <div className="flex gap-4">
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="e.g., D:\IBM HACKATHON"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-medium px-6 py-2 rounded-lg transition-colors"
              >
                {loading ? 'Scanning Access Keys...' : 'Analyze Credential Access'}
              </button>
            </div>
          </form>
          {error && <p className="text-sm text-rose-400 mt-3 font-medium">⚠️ {error}</p>}
        </section>

        {data && (
          <div className="space-y-8">
            <div className="flex justify-end">
              <button
                onClick={triggerSandboxProvisioning}
                disabled={provisioning}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition-all shadow-lg animate-bounce"
              >
                {provisioning ? 'Provisioning Isolated Sandboxes...' : '⚡ Deploy Autonomous Local Mock Sandboxes'}
              </button>
            </div>

            {logs.length > 0 && (
              <section className="bg-slate-900 border border-indigo-800/40 rounded-xl p-6 shadow-2xl space-y-4 bg-gradient-to-b from-slate-900 to-slate-950">
                <h2 className="text-lg font-bold text-indigo-400 flex items-center gap-2">⚙️ IBM Bob 2.0 Autonomous Provisioning Logs</h2>
                <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 font-mono text-xs space-y-2 text-slate-300">
                  {logs.map((log, i) => (
                    <p key={i} className={log.includes('[Success]') ? 'text-emerald-400 font-bold' : ''}>{log}</p>
                  ))}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <section className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
                <h2 className="text-lg font-bold text-slate-200">🔒 Required Third-Party Integrations & Access Tokens</h2>
                <div className="space-y-4">
                  {Object.keys(data.directory_tree).map((folder) => (
                    <div key={folder} className="bg-slate-950 p-4 rounded-lg border border-slate-800/60 text-xs">
                      <ul className="space-y-3 text-slate-300 font-mono">
                        {data.directory_tree[folder].map((file) => (
                          <li key={file} className="p-2 bg-slate-900 rounded border border-slate-800 flex items-center justify-between">
                            <span>{file}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
                <h2 className="text-lg font-bold text-slate-200">🔗 Sandbox Workspace Redirections</h2>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {data.dependencies.map((dep, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px] flex flex-col gap-1">
                      <div className="flex justify-between items-center text-slate-400">
                        <span className="text-emerald-400 truncate font-bold">{dep.source}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900 border border-slate-800 text-indigo-400">{dep.type}</span>
                      </div>
                      <span className="text-slate-500 text-center text-[10px]">🔄 routed onto local sandbox</span>
                      <span className="text-slate-300 truncate font-semibold">➡️ {dep.target}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
