import { useEffect, useState } from 'react';

export default function TargetCard({ apiUrl, target, onOpenExecution }: { apiUrl: string; target: any; onOpenExecution: (id: string) => void }) {
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
      <div className="mt-3 space-y-2 max-h-64 overflow-auto">
        {executions.map((e: any) => (
          <div key={e.id} className="text-sm border border-emerald-900/50 rounded p-2">
            <div className="flex items-center justify-between">
              <span className="text-emerald-300/80">{e.mode} • {e.currentStage}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => onOpenExecution(e.id)} className="px-2 py-1 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/30">Open</button>
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
                {e.currentStage === 'ACTIVE_RECON' && (
                  <button
                    onClick={async () => {
                      const ok = confirm('Proceed to Stage 3: Spidering?');
                      if (!ok) return;
                      await fetch(`${apiUrl}/api/runs/${e.id}/advance-stage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ stage: 'SPIDERING' })
                      });
                    }}
                    className="px-2 py-1 rounded bg-emerald-600 text-black hover:bg-emerald-500"
                  >Stage 3</button>
                )}
                {e.currentStage === 'SPIDERING' && (
                  <button
                    onClick={async () => {
                      const ok = confirm('Proceed to Stage 4: Fuzzing?');
                      if (!ok) return;
                      await fetch(`${apiUrl}/api/runs/${e.id}/advance-stage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ stage: 'FUZZING' })
                      });
                    }}
                    className="px-2 py-1 rounded bg-emerald-600 text-black hover:bg-emerald-500"
                  >Stage 4</button>
                )}
                {e.currentStage === 'FUZZING' && (
                  <button
                    onClick={async () => {
                      const ok = confirm('Proceed to Stage 5: Vulnerability Scanning?');
                      if (!ok) return;
                      await fetch(`${apiUrl}/api/runs/${e.id}/advance-stage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ stage: 'VULN_SCANNING' })
                      });
                    }}
                    className="px-2 py-1 rounded bg-emerald-600 text-black hover:bg-emerald-500"
                  >Stage 5</button>
                )}
                <span className={`w-2.5 h-2.5 rounded-full ${statusColor(e.status)}`}></span>
              </div>
            </div>
            <div className="mt-2">
              <div className="h-2 w-full bg-emerald-900/40 rounded">
                <div className="h-2 bg-emerald-500 rounded" style={{ width: `${progressPct(e)}%` }}></div>
              </div>
              <div className="mt-1 text-emerald-300/70">{e.currentStep || 'idle'} ({e.stageCompletedSteps}/{e.stageTotalSteps})</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-emerald-300/80">
              <ArtifactLink apiUrl={apiUrl} executionId={e.id} name="all_subdomains_raw.txt" label="All Subs" />
              <ArtifactLink apiUrl={apiUrl} executionId={e.id} name="resolved_hosts.txt" label="Resolved" />
              <ArtifactLink apiUrl={apiUrl} executionId={e.id} name="live_urls.txt" label="Live URLs" />
              <ArtifactLink apiUrl={apiUrl} executionId={e.id} name="waf_report.txt" label="WAF Report" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-emerald-300/60 flex gap-4">
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span> Running</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400"></span> Completed</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Failed</div>
        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-300"></span> Paused</div>
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

export function progressPct(e: any) {
  if (!e.stageTotalSteps) return 0;
  return Math.min(100, Math.round((e.stageCompletedSteps / e.stageTotalSteps) * 100));
}

function ArtifactLink({ apiUrl, executionId, name, label }: { apiUrl: string; executionId: string; name: string; label: string }) {
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const res = await fetch(`${apiUrl}/api/artifacts/by-execution/${executionId}`);
      if (!res.ok) return;
      const list = await res.json();
      const item = list.find((x: any) => x.name === name);
      setPath(item?.id || null);
    })();
  }, [apiUrl, executionId, name]);
  if (!path) return <span className="opacity-40">{label}</span>;
  return <a className="underline hover:text-emerald-400" href={`${apiUrl}/api/artifacts/download/${path}`}>{label}</a>;
}