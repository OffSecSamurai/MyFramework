import React, { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { Play, Pause, Square, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface Task {
  id: string;
  tool: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED';
  startedAt?: string;
  completedAt?: string;
  output?: string;
  error?: string;
  metadata?: string;
}

interface Execution {
  id: string;
  targetId: string;
  mode: 'FULL' | 'CUSTOM' | 'SINGLE_TOOL';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  tasks: Task[];
}

interface ExecutionProgressProps {
  executionId: string;
  onStatusChange?: (status: string) => void;
}

export const ExecutionProgress: React.FC<ExecutionProgressProps> = ({ 
  executionId, 
  onStatusChange 
}) => {
  const [execution, setExecution] = useState<Execution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const socket = useSocket();

  useEffect(() => {
    fetchExecution();
    
    if (socket) {
      socket.emit('join-execution', executionId);
      
      socket.on('execution-update', (data: Execution) => {
        if (data.id === executionId) {
          setExecution(data);
          onStatusChange?.(data.status);
        }
      });

      socket.on('task-update', (data: { executionId: string; task: Task }) => {
        if (data.executionId === executionId) {
          setExecution(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              tasks: prev.tasks.map(task => 
                task.id === data.task.id ? data.task : task
              )
            };
          });
        }
      });

      socket.on('progress-update', (data: { executionId: string; progress: number }) => {
        if (data.executionId === executionId) {
          setExecution(prev => prev ? { ...prev, progress: data.progress } : null);
        }
      });
    }

    return () => {
      if (socket) {
        socket.emit('leave-execution', executionId);
        socket.off('execution-update');
        socket.off('task-update');
        socket.off('progress-update');
      }
    };
  }, [executionId, socket]);

  const fetchExecution = async () => {
    try {
      const response = await fetch(`/api/executions/${executionId}`);
      if (response.ok) {
        const data = await response.json();
        setExecution(data);
        onStatusChange?.(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch execution:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    try {
      await fetch(`/api/executions/${executionId}/pause`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to pause execution:', error);
    }
  };

  const handleResume = async () => {
    try {
      await fetch(`/api/executions/${executionId}/resume`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to resume execution:', error);
    }
  };

  const handleStop = async () => {
    try {
      await fetch(`/api/executions/${executionId}/stop`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to stop execution:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'RUNNING':
        return <Play className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'PAUSED':
        return <Pause className="w-5 h-5 text-yellow-500" />;
      case 'PENDING':
        return <Clock className="w-5 h-5 text-gray-500" />;
      case 'CANCELLED':
        return <XCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'FAILED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PENDING':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500';
      case 'FAILED':
        return 'bg-red-500';
      case 'RUNNING':
        return 'bg-blue-500 animate-pulse';
      case 'PAUSED':
        return 'bg-yellow-500';
      case 'PENDING':
        return 'bg-gray-300';
      case 'CANCELLED':
        return 'bg-gray-400';
      default:
        return 'bg-gray-300';
    }
  };

  const parseMetadata = (metadata: string) => {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  };

  if (isLoading) {
    return (
      <div className="bg-dark-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-dark-700 rounded w-1/4 mb-4"></div>
          <div className="h-2 bg-dark-700 rounded w-full mb-2"></div>
          <div className="h-2 bg-dark-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="bg-dark-800 rounded-lg p-6">
        <div className="text-center text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <p>Execution not found</p>
        </div>
      </div>
    );
  }

  const completedTasks = execution.tasks.filter(t => t.status === 'COMPLETED').length;
  const totalTasks = execution.tasks.length;
  const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="bg-dark-800 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          {getStatusIcon(execution.status)}
          <div>
            <h3 className="text-lg font-semibold text-white">
              Execution {execution.id.slice(0, 8)}
            </h3>
            <p className="text-sm text-gray-400">
              Mode: {execution.mode} • {execution.tasks.length} tools
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(execution.status)}`}>
            {execution.status}
          </span>
          
          {execution.status === 'RUNNING' && (
            <button
              onClick={handlePause}
              className="btn btn-secondary btn-sm"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          
          {execution.status === 'PAUSED' && (
            <button
              onClick={handleResume}
              className="btn btn-primary btn-sm"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}
          
          {(execution.status === 'RUNNING' || execution.status === 'PAUSED') && (
            <button
              onClick={handleStop}
              className="btn btn-danger btn-sm"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Overall Progress</span>
          <span className="text-sm text-gray-400">
            {completedTasks} / {totalTasks} tasks completed
          </span>
        </div>
        <div className="w-full bg-dark-700 rounded-full h-3">
          <div
            className="bg-primary h-3 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{execution.startedAt ? new Date(execution.startedAt).toLocaleTimeString() : 'Not started'}</span>
          <span>{execution.completedAt ? new Date(execution.completedAt).toLocaleTimeString() : 'In progress'}</span>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        <h4 className="text-md font-medium text-white mb-3">Tools Progress</h4>
        {execution.tasks.map((task) => {
          const metadata = parseMetadata(task.metadata || '{}');
          const processingStats = metadata.processingStats || {};
          
          return (
            <div key={task.id} className="bg-dark-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getTaskStatusColor(task.status)}`}></div>
                  <span className="font-medium text-white">{task.tool}</span>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                  {task.status}
                </span>
              </div>
              
              <div className="text-sm text-gray-400 space-y-1">
                {task.startedAt && (
                  <p>Started: {new Date(task.startedAt).toLocaleTimeString()}</p>
                )}
                {task.completedAt && (
                  <p>Completed: {new Date(task.completedAt).toLocaleTimeString()}</p>
                )}
                {task.error && (
                  <p className="text-red-400">Error: {task.error}</p>
                )}
                
                {/* Processing Statistics */}
                {metadata.rawCount !== undefined && (
                  <div className="mt-2 p-2 bg-dark-600 rounded text-xs">
                    <p className="text-gray-300 mb-1">Data Processing:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <span>Raw: {metadata.rawCount}</span>
                      <span>Processed: {metadata.processedCount}</span>
                      {processingStats.cleaned && <span>Cleaned: {processingStats.cleaned}</span>}
                      {processingStats.deduplicated && <span>Deduplicated: {processingStats.deduplicated}</span>}
                      {processingStats.validated && <span>Validated: {processingStats.validated}</span>}
                      {processingStats.enriched && <span>Enriched: {processingStats.enriched}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Execution Statistics */}
      {execution.status === 'COMPLETED' && (
        <div className="mt-6 p-4 bg-dark-700 rounded-lg">
          <h4 className="text-md font-medium text-white mb-3">Execution Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{completedTasks}</div>
              <div className="text-gray-400">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">
                {execution.tasks.filter(t => t.status === 'FAILED').length}
              </div>
              <div className="text-gray-400">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {execution.tasks.filter(t => t.status === 'CANCELLED').length}
              </div>
              <div className="text-gray-400">Cancelled</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {Math.round(progressPercentage)}%
              </div>
              <div className="text-gray-400">Success Rate</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};