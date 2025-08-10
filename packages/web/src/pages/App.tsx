import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { manualTips } from '../data/manualTips';

const socket = io('http://localhost:4000');

type StageStatus = 'queued' | 'running' | 'completed' | 'failed';

interface StageUpdate {
  stage: string;
  status: StageStatus;
}

interface ExecutionState {
  executionId: string;
  stages: Record<string, StageStatus>;
  overall: StageStatus;
  error?: string;
}

const statusColor: Record<StageStatus, string> = {
  queued: 'bg-gray-600',
  running: 'bg-blue-600',
  completed: 'bg-green-600',
  failed: 'bg-red-600'
};

const StageCard: React.FC<{ name: string; status: StageStatus; onPause?: () => void; onStop?: () => void; }>
  = ({ name, status }) => (
    <div className={`p-2 rounded shadow-md text-sm ${statusColor[status]} text-white`}> {name} </div>
  );

const App: React.FC = () => {
  const [executions, setExecutions] = useState<Record<string, ExecutionState>>({});
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    socket.on('stage-status', ({ executionId, stage, status }: { executionId: string; stage: string; status: StageStatus; }) => {
      setExecutions((prev) => {
        const exec = prev[executionId] || { executionId, stages: {}, overall: 'queued' as StageStatus };
        exec.stages[stage] = status;
        exec.overall = status === 'failed' ? 'failed' : (status === 'completed' && Object.values(exec.stages).every((s) => s === 'completed') ? 'completed' : 'running');
        return { ...prev, [executionId]: { ...exec } };
      });
    });

    socket.on('execution-completed', ({ executionId }: { executionId: string; }) => {
      setExecutions((prev) => {
        const exec = prev[executionId];
        if (!exec) return prev;
        exec.overall = 'completed';
        return { ...prev, [executionId]: { ...exec } };
      });
    });

    socket.on('execution-failed', ({ executionId, error }: { executionId: string; error?: string; }) => {
      setExecutions((prev) => {
        const exec = prev[executionId];
        if (!exec) return prev;
        exec.overall = 'failed';
        exec.error = error;
        return { ...prev, [executionId]: { ...exec } };
      });
    });

    return () => {
      socket.off('stage-status');
      socket.off('execution-completed');
      socket.off('execution-failed');
    };
  }, []);

  return (
    <div className="min-h-screen p-6 bg-black text-primary">
      <h1 className="text-2xl font-bold mb-6">Akshay's Framework Dashboard</h1>
      <button
        className="mb-4 px-3 py-1 bg-primary text-black rounded text-sm"
        onClick={() => setShowTips(true)}
      >
        Manual Testing Guide
      </button>
      <div className="space-y-6">
        {Object.values(executions).map((exec) => {
          const completedCount = Object.values(exec.stages).filter((s) => s === 'completed').length;
          const total = Object.keys(exec.stages).length || 1;
          const percent = Math.round((completedCount / total) * 100);
          return (
            <div key={exec.executionId} className="border border-gray-700 rounded p-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-semibold">Execution {exec.executionId.slice(0, 8)}</h2>
                <span className={`px-2 py-1 text-xs rounded ${statusColor[exec.overall]} text-white`}>{exec.overall}</span>
              </div>
              {/* progress bar */}
              <div className="w-full bg-gray-800 h-2 rounded mb-4">
                <div className="h-2 rounded bg-primary" style={{ width: `${percent}%` }}></div>
              </div>
              {/* stage cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-2">
                {Object.entries(exec.stages).map(([stageName, st]) => (
                  <StageCard key={stageName} name={stageName} status={st} />
                ))}
              </div>
              {/* artifacts */}
              {exec.overall === 'completed' && (
                <ArtifactsList executionId={exec.executionId} />
              )}
              {exec.error && <p className="text-red-500 text-xs">Error: {exec.error}</p>}
            </div>
          );
        })}
      </div>

      {/* Manual Tips Modal */}
      {showTips && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 max-w-2xl w-full max-h-full overflow-y-auto rounded p-6 relative">
            <button
              className="absolute top-2 right-2 text-white text-xl"
              onClick={() => setShowTips(false)}
            >
              &times;
            </button>
            <div className="prose prose-invert text-primary" dangerouslySetInnerHTML={{ __html: markdownToHtml(manualTips) }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

// ArtifactsList component
const ArtifactsList: React.FC<{ executionId: string }> = ({ executionId }) => {
  const [artifacts, setArtifacts] = React.useState<Array<{ id: string; type: string }>>([]);
  const [open, setOpen] = React.useState(false);

  const toggle = async () => {
    if (!open && artifacts.length === 0) {
      const res = await fetch(`http://localhost:4000/executions/${executionId}/artifacts`);
      const data = await res.json();
      setArtifacts(data);
    }
    setOpen(!open);
  };

  return (
    <div className="mt-2">
      <button className="text-xs underline" onClick={toggle}>
        {open ? 'Hide' : 'Show'} artifacts
      </button>
      {open && (
        <ul className="mt-1 text-xs space-y-1 list-disc list-inside">
          {artifacts.map((a) => (
            <li key={a.id}>
              <a
                href={`http://localhost:4000/artifacts/${a.id}/download`}
                className="text-primary hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {a.type}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// markdown to html quick converter (basic)
function markdownToHtml(md: string) {
  return md
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    .replace(/\n$/gim, '<br />');
}
