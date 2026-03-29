import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Revenue from './pages/Revenue';
import Brands from './pages/Brands';
import CreatorPayments from './pages/CreatorPayments';

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-60 p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/creators" element={<CreatorPayments />} />
        </Routes>
      </main>
    </div>
  );
}
