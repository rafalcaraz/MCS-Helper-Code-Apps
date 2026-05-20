import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AgentsPage } from './pages/AgentsPage'
import { AgentDetailPage } from './pages/AgentDetailPage'
import { AgentSnapshotPage } from './pages/AgentSnapshotPage'
import { CaseDetailPage } from './pages/CaseDetailPage'
import { TestSetDetailPage } from './pages/TestSetDetailPage'
import { RunDetailPage } from './pages/RunDetailPage'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/agents" replace />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/:agentId" element={<AgentDetailPage />} />
        <Route
          path="/agents/:agentId/snapshot"
          element={<AgentSnapshotPage />}
        />
        <Route
          path="/agents/:agentId/testsets/:testSetId"
          element={<TestSetDetailPage />}
        />
        <Route
          path="/agents/:agentId/testsets/:testSetId/cases/:caseId"
          element={<CaseDetailPage />}
        />
        <Route
          path="/agents/:agentId/runs/:runId"
          element={<RunDetailPage />}
        />
        <Route path="*" element={<Navigate to="/agents" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
