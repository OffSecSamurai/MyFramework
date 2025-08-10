import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';

export default function App() {
  const [apiUrl] = useState<string>(import.meta.env.VITE_API_URL || 'http://localhost:4000');
  const [targets, setTargets] = useState<any[]>([]);

  async function fetchTargets() {
    const res = await fetch(`${apiUrl}/api/targets`);
    const data = await res.json();
    setTargets(data);
  }

  useEffect(() => {
    fetchTargets();
  }, []);

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-emerald-400">Akshay's Framework</h1>
        <p className="text-emerald-300/70">Phased reconnaissance and vulnerability testing</p>
      </header>
      <Dashboard apiUrl={apiUrl} targets={targets} onRefresh={fetchTargets} />
    </div>
  );
}