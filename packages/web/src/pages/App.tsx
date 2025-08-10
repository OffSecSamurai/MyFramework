import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:4000');

interface ExecutionUpdate {
  executionId: string;
  stage?: string;
  status?: string;
  error?: string;
}

const App: React.FC = () => {
  const [updates, setUpdates] = useState<ExecutionUpdate[]>([]);

  useEffect(() => {
    socket.on('stage-status', (data: ExecutionUpdate) => {
      setUpdates((prev) => [...prev, data]);
    });
    socket.on('execution-completed', (data: ExecutionUpdate) => {
      setUpdates((prev) => [...prev, { ...data, status: 'completed' }]);
    });
    socket.on('execution-failed', (data: ExecutionUpdate) => {
      setUpdates((prev) => [...prev, { ...data, status: 'failed' }]);
    });

    return () => {
      socket.off('stage-status');
      socket.off('execution-completed');
      socket.off('execution-failed');
    };
  }, []);

  return (
    <div className="min-h-screen p-4 bg-black text-primary">
      <h1 className="text-2xl font-bold mb-4">Akshay's Framework Dashboard</h1>
      <pre className="text-xs bg-gray-900 p-2 rounded">
        {JSON.stringify(updates, null, 2)}
      </pre>
    </div>
  );
};

export default App;