import { useEffect, useState } from 'react';

export default function TargetCard({ apiUrl, target }: { apiUrl: string; target: any }) {
  const [executions, setExecutions] = useState<any[]>(target.executions || []);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${apiUrl}/api/targets/${target.name}`);
      if (res.ok) {
        const t = await res.json();
        setExecutions(t.executions || []);
      }
    })();
  }, [apiUrl, target.name]);

  return (
    <div className="border border-emerald-800 rounded p-4 bg-gradient-to-br from-black to-emerald-900/10 hover:to-emerald-800/10 transition">
      <h3 className="text-xl font-semibold text-emerald-400">{target.name}</h3>
      <p className="text-emerald-300/70">Executions: {executions.length}</p>
      <div className="mt-3 space-y-2 max-h-48 overflow-auto">
        {executions.map((e: any) => (
          <div key={e.id} className="flex items-center justify-between text-sm">
            <span className="text-emerald-300/80">{e.mode} • {e.currentStage}</span>
            <div className="flex items-center gap-2">
              {e.currentStage === 'PASSIVE_RECON' && (
                <button
                  onClick={async () => {
                    const ok = confirm('Proceed to Stage 2: Active Recon?');
                    if (!ok) return;
                    await fetch(`${apiUrl}/api/runs/${e.id}/advance-stage`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ stage: 'ACTIVE_RECON' })
                    });
                  }}
                  className="px-2 py-1 rounded bg-emerald-600 text-black hover:bg-emerald-500"
                >Stage 2</button>
              )}
              <span className={`w-2.5 h-2.5 rounded-full ${statusColor(e.status)}`}></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusColor(status: string) {
  switch (status) {
    case 'RUNNING': return 'bg-blue-400';
    case 'COMPLETED': return 'bg-green-400';
    case 'FAILED': return 'bg-red-500';
    case 'PAUSED': return 'bg-yellow-300';
    default: return 'bg-gray-400';
  }
}