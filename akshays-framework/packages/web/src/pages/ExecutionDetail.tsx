import { useEffect, useState } from 'react';
import StageView from '../components/StageView';

export default function ExecutionDetail({ apiUrl, executionId }: { apiUrl: string; executionId: string }) {
  const [exec, setExec] = useState<any>(null);
  const [log, setLog] = useState<string>('');

  async function load() {
    const res = await fetch(`${apiUrl}/api/runs/${executionId}`);
    if (res.ok) setExec(await res.json());
  }

  useEffect(() => { load(); }, [executionId]);

  useEffect(() => {
    (async () => {
      if (!exec) return;
      const base = exec.storagePath;
      const stage = exec.currentStage;
      const logName = stage === 'PASSIVE_RECON' ? 'stage1_passive_recon.log' : stage === 'ACTIVE_RECON' ? 'stage2_active_recon.log' : stage === 'SPIDERING' ? 'stage3_spidering.log' : stage === 'FUZZING' ? 'stage4_fuzzing.log' : '';
      if (!logName) return;
      try {
        const res = await fetch(`${apiUrl}/api/artifacts/by-execution/${executionId}`);
        if (!res.ok) return;
        const artifacts = await res.json();
        const item = artifacts.find((a: any) => a.name === logName);
        if (item) {
          const textRes = await fetch(`${apiUrl}/api/artifacts/download/${item.id}`);
          const t = await textRes.text();
          setLog(t);
        }
      } catch {}
    })();
  }, [exec]);

  if (!exec) return null;

  return (
    <div className="space-y-4">
      <StageView apiUrl={apiUrl} executionId={executionId} />
      <div>
        <div className="text-emerald-400 font-semibold mb-2">Live Logs</div>
        <pre className="bg-black border border-emerald-900/60 rounded p-3 text-emerald-300/80 whitespace-pre-wrap max-h-96 overflow-auto">{log || 'No logs yet'}</pre>
      </div>
    </div>
  );
}