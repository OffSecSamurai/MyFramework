import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import ExecutionDetail from './pages/ExecutionDetail';

export default function App() {
  const [apiUrl] = useState<string>(import.meta.env.VITE_API_URL || 'http://localhost:4000');
  const [targets, setTargets] = useState<any[]>([]);
  const [route, setRoute] = useState<{ name: 'dashboard' | 'execution', executionId?: string }>({ name: 'dashboard' });

  async function fetchTargets() {
    const res = await fetch(`${apiUrl}/api/targets`);
    const data = await res.json();
    setTargets(data);
  }

  useEffect(() => {
    fetchTargets();
  }, []);

  const goExecution = (id: string) => setRoute({ name: 'execution', executionId: id });
  const goDashboard = () => setRoute({ name: 'dashboard' });

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-emerald-400" style={{cursor:'pointer'}} onClick={goDashboard}>Akshay's Framework</h1>
          <p className="text-emerald-300/70">Phased reconnaissance and vulnerability testing</p>
        </div>
      </header>
      {route.name === 'dashboard' && (
        <Dashboard apiUrl={apiUrl} targets={targets} onRefresh={fetchTargets} onOpenExecution={goExecution} />
      )}
      {route.name === 'execution' && route.executionId && (
        <ExecutionDetail apiUrl={apiUrl} executionId={route.executionId} />
      )}
    </div>
  );
}