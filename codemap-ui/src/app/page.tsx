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
    <div className="app-container">
      
      {/* Minimal Header */}
      <header className="app-header">
        <div>
          <h1 className="app-title">TokenFlow AI</h1>
          <p className="app-subtitle">
            Autonomous Developer Access & Sandbox Provisioning Platform • Powered by IBM Bob 2.0
          </p>
        </div>
        <span className="status-badge">SecOps Core Online</span>
      </header>

      {/* Input Field Section */}
      <section className="form-card">
        <form onSubmit={scanAccessRequirements}>
          <label className="form-label">Target Enterprise Project Repository Path</label>
          <div className="form-input-row">
            <input
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="e.g., D:\B2C-E-Commerce-Project"
              className="form-input"
            />
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Scanning...' : 'Analyze Credential Access'}
            </button>
          </div>
        </form>
        {error && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '12px', fontMono: 'true' }}>[Error] {error}</p>}
      </section>

      {/* Main Analysis Results Layout Workspace */}
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Action Trigger Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={triggerSandboxProvisioning} disabled={provisioning} className="btn-secondary">
              {provisioning ? 'Provisioning...' : 'Deploy Autonomous Local Mock Sandboxes'}
            </button>
          </div>

          {/* Execution Output Console Logs */}
          {logs.length > 0 && (
            <section className="terminal-card">
              <h2 className="terminal-title">IBM Bob 2.0 Autonomous Provisioning Logs</h2>
              <div className="terminal-window">
                {logs.map((log, i) => (
                  <p key={i} style={{ 
                    margin: '4px 0',
                    color: log.includes('[Success]') ? '#ffffff' : '#cbd5e1',
                    fontWeight: log.includes('[Success]') ? 'bold' : 'normal'
                  }}>
                    {log}
                  </p>
                ))}
              </div>
            </section>
          )}

          {/* Highly Structured Content Grid */}
          <div className="workspace-grid">
            
            {/* Required Access Tokens Column */}
            <section className="panel-card">
              <h2 className="panel-title">Required Third-Party Integrations & Access Tokens</h2>
              <div>
                {Object.keys(data.directory_tree).map((folder) => (
                  <div key={folder}>
                    {data.directory_tree[folder].map((file) => (
                      <div key={file} className="item-row">
                        {file}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            {/* Sandbox Redirections Column */}
            <section className="panel-card">
              <h2 className="panel-title">Sandbox Redirections</h2>
              <div>
                {data.dependencies.map((dep, idx) => (
                  <div key={idx} className="mapping-box">
                    <div className="mapping-header">
                      <span className="source-node">{dep.source}</span>
                      <span className="type-tag">{dep.type}</span>
                    </div>
                    <div className="route-text">routed to local sandbox</div>
                    <div className="target-node">text ➡️ {dep.target}</div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>
      )}

    </div>
  );
}
