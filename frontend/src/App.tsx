import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { DashboardPage } from './pages/DashboardPage'
import { WorkLogPage } from './pages/WorkLogPage'
import { ProblemsPage } from './pages/ProblemsPage'
import { ProblemStudioPage } from './pages/ProblemStudioPage'
import { DailyLogPage } from './pages/DailyLogPage'
import { TrashPage } from './pages/TrashPage'
import { SettingsPage } from './pages/SettingsPage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import { ReportsPage } from './pages/ReportsPage'
import { NotificationsPage } from './pages/NotificationsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="worklogs" element={<WorkLogPage />} />
        <Route path="problems" element={<ProblemsPage />} />
        <Route path="problems/:id" element={<ProblemStudioPage />} />
        <Route path="dailylogs" element={<DailyLogPage />} />
        <Route path="trash" element={<TrashPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="tasks/:id" element={<TaskDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
