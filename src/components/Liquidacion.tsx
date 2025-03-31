import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DentalRecord } from '../types';
import { formatCOP } from '../data/constants';


interface LiquidacionProps {
  registros: DentalRecord[];
  setRegistros: (registros: DentalRecord[]) => void;
}

const Liquidacion: React.FC<LiquidacionProps> = ({ registros }) => {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [doctorSeleccionado, setDoctorSeleccionado] = useState('');
  const [doctores, setDoctores] = useState<string[]>([]);
  const [liquidacion, setLiquidacion] = useState<DentalRecord[]>([]);
  const [totalLiquidado, setTotalLiquidado] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDoctores = async () => {
      try {
        const fetchedDoctores = await axios.get<string[]>(
          `${import.meta.env.VITE_API_URL}/api/doctors`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
        setDoctores(fetchedDoctores.data);
      } catch {
        setError('Error al cargar los doctores.');
      }
    };

    fetchDoctores();
  }, []);

  const calcularLiquidacion = () => {
    if (!fechaInicio || !fechaFin || !doctorSeleccionado) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    const registrosFiltrados = registros.filter(
      (registro) =>
        registro.nombreDoctor === doctorSeleccionado &&
        registro.fecha >= fechaInicio &&
        registro.fecha <= fechaFin
    );

    const total = registrosFiltrados.reduce((sum, registro) => {
      const porcentaje = registro.idPorc === 1 ? 0.4 : registro.idPorc === 2 ? 0.5 : 0;
      return sum + registro.total * porcentaje;
    }, 0);

    setLiquidacion(registrosFiltrados);
    setTotalLiquidado(total);
    setError('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-6">Liquidación - Clínica Smiley</h2>

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Doctor/a</label>
            <select
              value={doctorSeleccionado}
              onChange={(e) => setDoctorSeleccionado(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Selecciona un doctor/a</option>
              {doctores.map((doctor) => (
                <option key={doctor} value={doctor}>
                  {doctor}
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
            onClick={calcularLiquidacion}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Calcular Liquidación
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {liquidacion.length > 0 && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resultados de la Liquidación</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paciente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Servicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Porcentaje
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total a Liquidar
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {liquidacion.map((registro) => {
                const porcentaje = registro.idPorc === 1 ? 0.4 : registro.idPorc === 2 ? 0.5 : 0;
                const totalALiquidar = registro.total * porcentaje;

                return (
                  <tr key={registro.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {registro.nombrePaciente}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {registro.servicio}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCOP(registro.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {porcentaje * 100}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      {formatCOP(totalALiquidar)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-6 text-right">
            <p className="text-lg font-semibold text-gray-900">
              Total Liquidado: {formatCOP(totalLiquidado)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Liquidacion;