import { useEffect, useMemo, useState } from 'react';
import TargetCard from './TargetCard';
import { io } from 'socket.io-client';

export default function Dashboard({ apiUrl, targets, onRefresh, onOpenExecution }: { apiUrl: string; targets: any[]; onRefresh: () => void; onOpenExecution: (id: string) => void }) {
  const [target, setTarget] = useState('');
  const [mode, setMode] = useState<'FULL' | 'CUSTOM' | 'SINGLE'>('FULL');
  const socket = useMemo(() => io(apiUrl, { path: '/socket.io' }), [apiUrl]);

  useEffect(() => {
    socket.on('progress', () => {
      onRefresh();
    });
    return () => {
      socket.off('progress');
      socket.disconnect();
    };
  }, [socket]);

  async function startRun() {
    const res = await fetch(`${apiUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, mode, threads: 50, useNative: false })
    });
    if (res.ok) onRefresh();
  }

  return (
    <div>
      <div className="mb-6 grid gap-4 grid-cols-1 md:grid-cols-3">
        <input className="bg-black border border-emerald-700 rounded px-3 py-2 text-emerald-200" placeholder="target.com" value={target} onChange={(e) => setTarget(e.target.value)} />
        <select className="bg-black border border-emerald-700 rounded px-3 py-2 text-emerald-200" value={mode} onChange={(e) => setMode(e.target.value as any)}>
          <option value="FULL">Full</option>
          <option value="CUSTOM">Custom</option>
          <option value="SINGLE">Single-Tool</option>
        </select>
        <button className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold rounded px-3 py-2" onClick={startRun}>Start (Stage 1)</button>
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {targets.map((t) => (
          <TargetCard key={t.id} apiUrl={apiUrl} target={t} onOpenExecution={onOpenExecution} />
        ))}
      </div>
    </div>
  );
}