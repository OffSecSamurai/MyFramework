import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';

// Create a query client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-900 text-white">
          <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold text-green-500 mb-8">
              Akshay's Framework 🚀
            </h1>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4">Welcome to Akshay's Framework</h2>
              <p className="text-gray-300 mb-4">
                A comprehensive reconnaissance and vulnerability testing framework for bug bounty hunters and security researchers.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-400 mb-2">Targets</h3>
                  <p className="text-gray-300 text-sm">Manage your reconnaissance targets</p>
                </div>
                
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-400 mb-2">Executions</h3>
                  <p className="text-gray-300 text-sm">Monitor reconnaissance runs</p>
                </div>
                
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-400 mb-2">Vulnerabilities</h3>
                  <p className="text-gray-300 text-sm">View security findings</p>
                </div>
                
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-400 mb-2">Reports</h3>
                  <p className="text-gray-300 text-sm">Generate comprehensive reports</p>
                </div>
                
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-400 mb-2">Real-time Updates</h3>
                  <p className="text-gray-300 text-sm">Live progress tracking</p>
                </div>
                
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-400 mb-2">Data Processing</h3>
                  <p className="text-gray-300 text-sm">Automatic deduplication and cleaning</p>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-green-900 rounded-lg">
                <h3 className="text-lg font-semibold text-green-300 mb-2">Framework Status</h3>
                <p className="text-green-200 text-sm">
                  ✅ Backend API: Running on port 3001<br/>
                  ✅ Database: SQLite with Prisma ORM<br/>
                  ✅ Job Queue: BullMQ with Redis<br/>
                  ✅ WebSocket: Real-time updates<br/>
                  ✅ Docker: Multi-service setup<br/>
                  🔧 Frontend: Basic UI (full UI coming soon)
                </p>
              </div>
            </div>
          </div>
        </div>
      </Router>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;