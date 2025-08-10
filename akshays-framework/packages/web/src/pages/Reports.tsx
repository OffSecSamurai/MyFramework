import { useEffect, useMemo, useState } from 'react';

type Item = { url: string; status?: string; tech?: string };

export default function Reports({ apiUrl, executionId }: { apiUrl: string; executionId: string }) {
  const [liveWithTech, setLiveWithTech] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [techFilter, setTechFilter] = useState<string>('');

  useEffect(() => {
    (async () => {
      const res = await fetch(`${apiUrl}/api/artifacts/by-execution/${executionId}`);
      if (!res.ok) return;
      const artifacts = await res.json();
      const item = artifacts.find((a: any) => a.name === 'live_hosts_with_tech.txt');
      if (!item) return;
      const textRes = await fetch(`${apiUrl}/api/artifacts/download/${item.id}`);
      const text = await textRes.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      setLiveWithTech(lines);
      const parsed: Item[] = lines.map((l) => {
        const parts = l.trim().split(/\s+/);
        const url = parts[0];
        const status = (parts.find((p) => /^\[\d{3}\]$/.test(p)) || '').replace(/\[|\]/g, '');
        const techIdx = parts.findIndex((p) => p === '[tech]');
        const tech = techIdx !== -1 ? parts.slice(techIdx + 1).join(' ') : undefined;
        return { url, status, tech };
      });
      setItems(parsed);
    })();
  }, [apiUrl, executionId]);

  const filtered = useMemo(() => {
    return items.filter((i) => (!statusFilter || i.status === statusFilter) && (!techFilter || (i.tech || '').toLowerCase().includes(techFilter.toLowerCase())));
  }, [items, statusFilter, techFilter]);

  const statuses = useMemo(() => Array.from(new Set(items.map((i) => i.status).filter(Boolean) as string[])), [items]);

  const domainStats = useMemo(() => {
    const domains = new Set<string>();
    const statusCounts: Record<string, number> = {};
    const techCounts: Record<string, number> = {};
    for (const it of filtered) {
      try { domains.add(new URL(it.url).hostname); } catch {}
      if (it.status) statusCounts[it.status] = (statusCounts[it.status] || 0) + 1;
      if (it.tech) {
        (it.tech.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)).forEach((t) => {
          techCounts[t] = (techCounts[t] || 0) + 1;
        });
      }
    }
    return { domainCount: domains.size, statusCounts, techCounts };
  }, [filtered]);

  function exportCsv() {
    const header = ['url','status','tech'];
    const rows = filtered.map((i) => [i.url, i.status || '', (i.tech || '').replace(/,/g, ';')]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'report.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="border border-emerald-800 rounded p-3">
          <div className="text-emerald-300/70 text-sm">Unique Domains</div>
          <div className="text-2xl text-emerald-400 font-semibold">{domainStats.domainCount}</div>
        </div>
        <div className="border border-emerald-800 rounded p-3">
          <div className="text-emerald-300/70 text-sm">Total URLs</div>
          <div className="text-2xl text-emerald-400 font-semibold">{filtered.length}</div>
        </div>
        <div className="border border-emerald-800 rounded p-3 col-span-2">
          <div className="text-emerald-300/70 text-sm mb-1">Top Statuses</div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(domainStats.statusCounts).sort((a,b) => b[1]-a[1]).slice(0,6).map(([k,v]) => (
              <div key={k} className="px-2 py-1 rounded bg-emerald-900/40 text-emerald-200 text-sm">{k}: {v}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <label className="block text-emerald-300/70 text-sm mb-1">Filter by Status</label>
          <select className="bg-black border border-emerald-700 rounded px-2 py-1 text-emerald-200 w-full" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {statuses.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-emerald-300/70 text-sm mb-1">Filter by Tech</label>
          <input className="bg-black border border-emerald-700 rounded px-2 py-1 text-emerald-200 w-full" value={techFilter} onChange={(e) => setTechFilter(e.target.value)} placeholder="e.g., nginx, react" />
        </div>
        <div className="flex items-end justify-end">
          <button onClick={exportCsv} className="px-3 py-2 rounded bg-emerald-600 text-black hover:bg-emerald-500">Export CSV</button>
        </div>
      </div>
      <div className="border border-emerald-900/50 rounded">
        <div className="grid grid-cols-12 text-emerald-300/70 text-xs px-2 py-1 border-b border-emerald-900/60">
          <div className="col-span-7">URL</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Tech</div>
        </div>
        <div className="max-h-96 overflow-auto divide-y divide-emerald-900/50">
          {filtered.map((i) => (
            <div key={i.url} className="grid grid-cols-12 px-2 py-1 text-sm">
              <div className="col-span-7 truncate"><a className="underline hover:text-emerald-400" href={i.url} target="_blank" rel="noreferrer">{i.url}</a></div>
              <div className="col-span-2">{i.status || '-'}</div>
              <div className="col-span-3 truncate">{i.tech || '-'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}