import React from 'react';
import { Download, Eye, Search, AlertTriangle, CheckCircle } from 'lucide-react';

interface ResultsDisplayProps {
  data: any[];
  type: 'subdomains' | 'hosts' | 'urls' | 'vulnerabilities';
  onDownload?: () => void;
  onView?: (item: any) => void;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ data, type, onDownload, onView }) => {
  const getIcon = (item: any) => {
    switch (type) {
      case 'vulnerabilities':
        switch (item.severity) {
          case 'CRITICAL':
          case 'HIGH':
            return <AlertTriangle className="w-4 h-4 text-red-500" />;
          case 'MEDIUM':
            return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
          case 'LOW':
            return <AlertTriangle className="w-4 h-4 text-blue-500" />;
          default:
            return <CheckCircle className="w-4 h-4 text-green-500" />;
        }
      default:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const getStatusColor = (item: any) => {
    switch (type) {
      case 'vulnerabilities':
        switch (item.severity) {
          case 'CRITICAL':
            return 'text-red-500';
          case 'HIGH':
            return 'text-orange-500';
          case 'MEDIUM':
            return 'text-yellow-500';
          case 'LOW':
            return 'text-blue-500';
          default:
            return 'text-green-500';
        }
      default:
        return 'text-green-500';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white capitalize">
          {type} ({data.length})
        </h3>
        <div className="flex space-x-2">
          {onDownload && (
            <button
              onClick={onDownload}
              className="btn btn-primary btn-sm"
            >
              <Download className="w-4 h-4 mr-1" />
              Download
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {data.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <div className="flex items-center space-x-3">
              {getIcon(item)}
              <div>
                <p className="text-white font-medium">
                  {type === 'vulnerabilities' ? item.title : item}
                </p>
                {type === 'vulnerabilities' && (
                  <p className="text-gray-400 text-sm">
                    {item.tool} • {item.type}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {type === 'vulnerabilities' && (
                <span className={`text-sm font-medium ${getStatusColor(item)}`}>
                  {item.severity}
                </span>
              )}
              {onView && (
                <button
                  onClick={() => onView(item)}
                  className="btn btn-secondary btn-sm"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No {type} found</p>
        </div>
      )}
    </div>
  );
};

export default ResultsDisplay;