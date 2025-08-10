import { Routes, Route } from 'react-router-dom'
import { SocketProvider } from './contexts/SocketContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Targets from './pages/Targets'
import TargetDetail from './pages/TargetDetail'
import Executions from './pages/Executions'
import ExecutionDetail from './pages/ExecutionDetail'
import Vulnerabilities from './pages/Vulnerabilities'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

function App() {
  return (
    <SocketProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/targets" element={<Targets />} />
          <Route path="/targets/:id" element={<TargetDetail />} />
          <Route path="/executions" element={<Executions />} />
          <Route path="/executions/:id" element={<ExecutionDetail />} />
          <Route path="/vulnerabilities" element={<Vulnerabilities />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </SocketProvider>
  )
}

export default App