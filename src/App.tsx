// frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import RegistrosDiarios from './components/RegistrosDiarios';
import Liquidacion from './components/Liquidacion';
import EstandarizacionServicios from './components/EstandarizacionServicios';
import HistorialLiquidaciones from './components/HistorialLiquidaciones';
import Login from './components/Login';
import Sedes from './components/Sedes';
import { DentalRecord } from './types';

const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const token = localStorage.getItem('token');
  const selectedSede = localStorage.getItem('selectedSede');

  if (!token) return <Navigate to="/login" />;
  if (token === 'undefined') return <Navigate to="/login" />;
  if (token === 'null') return <Navigate to="/login" />;
  if (!selectedSede) return <Navigate to="/sedes" />;
  return children;
};

const AuthRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  const [registros, setRegistros] = useState<DentalRecord[]>([]);

  useEffect(() => {
    const registrosGuardados = localStorage.getItem('registrosDentales');
    if (registrosGuardados) {
      setRegistros(JSON.parse(registrosGuardados));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedSede');
    window.location.href = '/login';
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/sedes"
            element={
              <AuthRoute>
                <Sedes />
              </AuthRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <>
                  <Navbar onLogout={handleLogout} />
                  <RegistrosDiarios registros={registros} setRegistros={setRegistros} />
                </>
              </ProtectedRoute>
            }
          />
          <Route
            path="/liquidacion"
            element={
              <ProtectedRoute>
                <>
                  <Navbar onLogout={handleLogout} />
                  <Liquidacion registros={registros} setRegistros={setRegistros} />
                </>
              </ProtectedRoute>
            }
          />
          <Route
            path="/estandarizacion"
            element={
              <ProtectedRoute>
                <>
                  <Navbar onLogout={handleLogout} />
                  <EstandarizacionServicios />
                </>
              </ProtectedRoute>
            }
          />
          <Route
            path="/historial"
            element={
              <ProtectedRoute>
                <>
                  <Navbar onLogout={handleLogout} />
                  <HistorialLiquidaciones />
                </>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/sedes" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;