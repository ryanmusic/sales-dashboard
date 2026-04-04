import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Brands from './pages/Brands';
import CreatorPayments from './pages/CreatorPayments';
import Campaigns from './pages/Campaigns';
import CreateAccount from './pages/CreateAccount';
import Support from './pages/Support';
import VipDashboard from './pages/VipDashboard';
import Login from './pages/Login';

function ProtectedLayout() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 ml-60 p-8 overflow-y-auto overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/creators" element={<CreatorPayments />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/vip" element={<VipDashboard />} />
          <Route path="/support" element={<Support />} />
          <Route path="/create-account" element={<CreateAccount />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}
