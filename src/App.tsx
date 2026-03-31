import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Revenue from './pages/Revenue';
import Brands from './pages/Brands';
import CreatorPayments from './pages/CreatorPayments';
import Campaigns from './pages/Campaigns';
import Login from './pages/Login';

function ProtectedLayout() {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-60 p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/creators" element={<CreatorPayments />} />
          <Route path="/campaigns" element={<Campaigns />} />
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
