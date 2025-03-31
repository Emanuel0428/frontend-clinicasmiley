import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatCOP } from '../data/constants';
import { Sede, Doctor, Liquidacion } from '../types';


const HistorialLiquidaciones: React.FC = () => {
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [filteredLiquidaciones, setFilteredLiquidaciones] = useState<Liquidacion[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [doctores, setDoctores] = useState<Doctor[]>([]);
  const [selectedSede, setSelectedSede] = useState<string>('');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [sedesResponse, doctoresResponse, liquidacionesResponse] = await Promise.all([
          axios.get<Sede[]>(`${import.meta.env.VITE_API_URL}/api/sedes`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }),
          axios.get<Doctor[]>(`${import.meta.env.VITE_API_URL}/api/doctors`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }),
          axios.get<Liquidacion[]>(`${import.meta.env.VITE_API_URL}/api/liquidations`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }),
        ]);

        console.log('Sedes:', sedesResponse.data);
        console.log('Doctores:', doctoresResponse.data);
        console.log('Liquidaciones:', liquidacionesResponse.data);

        setSedes(sedesResponse.data);
        setDoctores(doctoresResponse.data);
        setLiquidaciones(liquidacionesResponse.data);
        setFilteredLiquidaciones(liquidacionesResponse.data);
      } catch (err) {
        console.error('Error fetching data:', (err as any).response?.data || (err as any).message);
        setError('Error al cargar los datos. Por favor, intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleFilter = () => {
    let filtered = liquidaciones;

    if (selectedSede) {
      filtered = filtered.filter((liq) =>
        liq.servicios.some((servicio) => servicio.sede === selectedSede)
      );
    }

    if (selectedDoctor) {
      filtered = filtered.filter((liq) => liq.doctor === selectedDoctor);
    }

    if (fechaInicio) {
      filtered = filtered.filter((liq) => new Date(liq.fecha_inicio) >= new Date(fechaInicio));
    }

    if (fechaFin) {
      filtered = filtered.filter((liq) => new Date(liq.fecha_fin) <= new Date(fechaFin));
    }

    setFilteredLiquidaciones(filtered);
  };

  if (loading) {
    return <div className="text-center py-6">Cargando datos...</div>;
  }

  if (error) {
    return <div className="text-center py-6 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-6">Historial de Liquidaciones - Clínica Smiley</h2>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sede</label>
            <select
              value={selectedSede}
              onChange={(e) => setSelectedSede(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Todas las sedes</option>
              {sedes.map((sede) => (
                <option key={sede.id_sede} value={sede.sede}>
                  {sede.sede}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Doctor/Auxiliar</label>
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {doctores.map((doctor) => (
                <option key={doctor.id_doc} value={doctor.nombre_doc}>
                  {doctor.nombre_doc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleFilter}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Filtrar
          </button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resultados</h3>
        {filteredLiquidaciones.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doctor/Auxiliar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Inicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Fin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Liquidado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLiquidaciones.map((liq) => (
                <tr key={liq.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{liq.doctor}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(liq.fecha_inicio).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(liq.fecha_fin).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    {formatCOP(liq.total_liquidado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-center">No se encontraron resultados.</p>
        )}
      </div>
    </div>
  );
};

export default HistorialLiquidaciones;