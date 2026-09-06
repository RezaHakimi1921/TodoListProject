import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { DailyLogPage } from './pages/DailyLogPage'
import { ProblemStudioPage } from './pages/ProblemStudioPage'
import { ProblemsPage } from './pages/ProblemsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import { TrashPage } from './pages/TrashPage'
import { WorkLogPage } from './pages/WorkLogPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/work" element={<WorkLogPage />} />
        <Route path="/problems" element={<ProblemsPage />} />
        <Route path="/problems/:id" element={<ProblemStudioPage />} />
        <Route path="/log" element={<DailyLogPage />} />
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
