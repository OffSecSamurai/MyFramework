import { useEffect, useMemo, useState } from 'react';

type vuln = { id: string; title: string; severity: string; source: string; details?: string; createdAt: string };

export default function Vulnerabilities({ apiUrl, executionId }: { apiUrl: string; executionId: string }) {
  const [vulns, setVulns] = useState<vuln[]>([]);
  const [severity, setSeverity] = useState<string>('');
  const [source, setSource] = useState<string>('');

  useEffect(() => {
    (async () => {
      const res = await fetch(`${apiUrl}/api/vulns/by-execution/${executionId}`);
      if (!res.ok) return;
      const data = await res.json();
      setVulns(data);
    })();
  }, [apiUrl, executionId]);

  const filtered = useMemo(() => {
    return vulns.filter((v) => (!severity || v.severity === severity) && (!source || v.source === source));
  }, [vulns, severity, source]);

  const severities = ['CRITICAL','HIGH','MEDIUM','LOW','INFO'];
  const sources = useMemo(() => Array.from(new Set(vulns.map((v) => v.source))), [vulns]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <label className="block text-emerald-300/70 text-sm mb-1">Severity</label>
          <select className="bg-black border border-emerald-700 rounded px-2 py-1 text-emerald-200 w-full" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">All</option>
            {severities.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-emerald-300/70 text-sm mb-1">Source</label>
          <select className="bg-black border border-emerald-700 rounded px-2 py-1 text-emerald-200 w-full" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            {sources.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
      </div>
      <div className="border border-emerald-900/50 rounded">
        <div className="grid grid-cols-12 text-emerald-300/70 text-xs px-2 py-1 border-b border-emerald-900/60">
          <div className="col-span-2">Severity</div>
          <div className="col-span-6">Title</div>
          <div className="col-span-2">Source</div>
          <div className="col-span-2">Discovered</div>
        </div>
        <div className="max-h-96 overflow-auto divide-y divide-emerald-900/50">
          {filtered.map((v) => (
            <div key={v.id} className="grid grid-cols-12 px-2 py-1 text-sm">
              <div className="col-span-2 font-semibold">{v.severity}</div>
              <div className="col-span-6 truncate" title={v.title}>{v.title}</div>
              <div className="col-span-2">{v.source}</div>
              <div className="col-span-2">{new Date(v.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {!filtered.length && (
            <div className="px-2 py-3 text-sm text-emerald-300/70">No findings</div>
          )}
        </div>
      </div>
    </div>
  );
}