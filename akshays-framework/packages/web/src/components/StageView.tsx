import { useEffect, useState } from 'react';

export default function StageView({ apiUrl, executionId }: { apiUrl: string; executionId: string }) {
  const [exec, setExec] = useState<any>(null);

  async function load() {
    const res = await fetch(`${apiUrl}/api/runs/${executionId}`);
    if (res.ok) setExec(await res.json());
  }

  useEffect(() => { load(); }, [executionId]);

  if (!exec) return null;

  async function action(path: string) {
    await fetch(`${apiUrl}/api/runs/${executionId}/${path}`, { method: 'POST' });
    await load();
  }

  const pct = exec.stageTotalSteps ? Math.round((exec.stageCompletedSteps / exec.stageTotalSteps) * 100) : 0;

  return (
    <div className="border border-emerald-900/50 rounded p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-emerald-400 font-semibold">{exec.currentStage}</div>
          <div className="text-emerald-300/70 text-sm">{exec.currentStep || 'idle'} ({exec.stageCompletedSteps}/{exec.stageTotalSteps})</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => action('pause')} className="px-2 py-1 rounded bg-yellow-300 text-black">Pause</button>
          <button onClick={() => action('resume')} className="px-2 py-1 rounded bg-blue-400 text-black">Resume</button>
          <button onClick={() => action('abort')} className="px-2 py-1 rounded bg-red-500 text-black">Abort</button>
        </div>
      </div>
      <div className="h-2 w-full bg-emerald-900/40 rounded mt-2">
        <div className="h-2 bg-emerald-500 rounded" style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
}