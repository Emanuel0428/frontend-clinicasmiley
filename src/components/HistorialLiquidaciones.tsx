import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { formatCOP } from '../data/constants';
import * as XLSX from 'xlsx';

interface DentalRecord {
  paciente: string;
  nombre_doc: string;
  nombre_serv: string;
  nombre_aux: string | null;
  abono: number;
  id_porc: number;
  porcentaje: number | null;
  id_metodo: number | null;
  metodoPago: string | null;
  id_metodo_abono: number | null;
  metodoPagoAbono: string | null;
  dcto: number;
  valor_total: number;
  es_paciente_propio: boolean;
  id_cuenta: number | null;
  id_cuenta_abono: number | null;
  valor_pagado: number;
  notas?: string | null;
}

interface LiquidacionHistorial {
  id: string;
  doctor: string;
  fecha_inicio: string;
  fecha_final: string;
  fecha_liquidacion: string;
  servicios: DentalRecord[];
  total_liquidado: number;
}

const HistorialLiquidaciones: React.FC = () => {
  const [historial, setHistorial] = useState<LiquidacionHistorial[]>([]);
  const [filteredHistorial, setFilteredHistorial] = useState<LiquidacionHistorial[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [filters, setFilters] = useState({
    fechaInicio: '',
    fechaFinal: '',
    doctor: '',
    auxiliar: '',
  });
  const [doctores, setDoctores] = useState<string[]>([]);
  const [auxiliares, setAuxiliares] = useState<string[]>([]);

  const navigate = useNavigate();
  const idSede = localStorage.getItem('selectedSede');

  useEffect(() => {
    const loadHistorial = async () => {
      try {
        if (!idSede) {
          throw new Error('No se ha seleccionado una sede');
        }

        setLoading(true);
        const response = await axios.get<LiquidacionHistorial[]>(`${import.meta.env.VITE_API_URL}/api/liquidations`, {
          params: { id_sede: idSede },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Cache-Control': 'no-cache',
          },
        });
        const data = response.data;
        setHistorial(data);
        setFilteredHistorial(data);

        const uniqueDoctores = Array.from(new Set(data.map((item) => item.doctor)));
        const uniqueAuxiliares = Array.from(
          new Set(
            data.flatMap((item) => item.servicios.map((servicio) => servicio.nombre_aux)).filter(
              (aux) => aux !== null
            )
          )
        ) as string[];
        setDoctores(uniqueDoctores);
        setAuxiliares(uniqueAuxiliares);
      } catch (err: any) {
        console.error('Error al cargar el historial de liquidaciones:', err);
        if (err.response?.status === 401) {
          setError('Sesión expirada. Por favor, inicia sesión nuevamente.');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('selectedSede');
          navigate('/login');
        } else {
          setError('Error al cargar el historial de liquidaciones. Por favor, intenta de nuevo.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadHistorial();
  }, [navigate, idSede]);

  useEffect(() => {
    const applyFilters = () => {
      let filtered = [...historial];

      if (filters.fechaInicio) {
        filtered = filtered.filter((item) => new Date(item.fecha_inicio) >= new Date(filters.fechaInicio));
      }
      if (filters.fechaFinal) {
        filtered = filtered.filter((item) => new Date(item.fecha_final) <= new Date(filters.fechaFinal));
      }
      if (filters.doctor) {
        filtered = filtered.filter((item) =>
          item.doctor.toLowerCase().includes(filters.doctor.toLowerCase())
        );
      }
      if (filters.auxiliar) {
        filtered = filtered.filter((item) =>
          item.servicios.some((servicio) =>
            servicio.nombre_aux?.toLowerCase().includes(filters.auxiliar.toLowerCase())
          )
        );
      }

      setFilteredHistorial(filtered);
    };

    applyFilters();
  }, [filters, historial]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleDescargarExcel = (liquidacion: LiquidacionHistorial) => {
    const datos = liquidacion.servicios.map((registro) => ({
      Paciente: registro.paciente,
      Servicio: registro.nombre_serv,
      Doctor: registro.nombre_doc || 'N/A',
      Asistente: registro.nombre_aux || 'N/A',
      Abono: formatCOP(registro.abono),
      Descuento: formatCOP(registro.dcto),
      'Valor Total': formatCOP(registro.valor_total),
      'Es Paciente Propio': registro.es_paciente_propio ? 'Sí' : 'No',
      Porcentaje: registro.porcentaje !== null ? 
        `${registro.id_porc === 3 ? 60 : registro.porcentaje}%` : 
        (registro.es_paciente_propio ? '50%' : '40%'),
      'Método de Pago': registro.metodoPago || 'N/A',
      'Método de Pago Abono': registro.metodoPagoAbono || 'N/A',
      'Valor Pagado': formatCOP(registro.valor_pagado),
      'Notas': registro.notas || 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(datos);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Liquidación');
    XLSX.writeFile(
      workbook,
      `Historial_Liquidacion_${liquidacion.doctor}_${liquidacion.fecha_inicio}.xlsx`
    );
  };

  if (loading) {
    return <div className="text-center py-6">Cargando historial...</div>;
  }

  if (error) {
    return <div className="text-center py-6 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Historial de Liquidaciones - Clínica Smiley</h2>

      <div className="bg-white shadow-md rounded-lg p-5 mb-6 border border-teal-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha Inicio</label>
            <input
              type="date"
              name="fechaInicio"
              value={filters.fechaInicio}
              onChange={handleFilterChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha Final</label>
            <input
              type="date"
              name="fechaFinal"
              value={filters.fechaFinal}
              onChange={handleFilterChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Doctor</label>
            <select
              name="doctor"
              value={filters.doctor}
              onChange={handleFilterChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Todos los doctores</option>
              {doctores.map((doctor) => (
                <option key={doctor} value={doctor}>
                  {doctor}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Auxiliar</label>
            <select
              name="auxiliar"
              value={filters.auxiliar}
              onChange={handleFilterChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Todos los auxiliares</option>
              {auxiliares.map((auxiliar) => (
                <option key={auxiliar} value={auxiliar}>
                  {auxiliar}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredHistorial.length === 0 ? (
        <p className="text-gray-600 text-center">No hay liquidaciones que coincidan con los filtros.</p>
      ) : (
        filteredHistorial.map((liquidacion) => (
          <div key={liquidacion.id} className="bg-white shadow-lg rounded-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Liquidación - {liquidacion.doctor}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Rango: {liquidacion.fecha_inicio} a {liquidacion.fecha_final}
                  </p>
                  <p className="text-sm text-gray-600">
                    Fecha de Liquidación: {liquidacion.fecha_liquidacion}
                  </p>
                  <p className="text-sm font-semibold text-blue-800">
                    Total Liquidado: {formatCOP(liquidacion.total_liquidado)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDescargarExcel(liquidacion)}
                className="px-4 py-2 rounded-md text-white font-medium bg-gradient-to-r from-teal-600 to-teal-700 hover:bg-teal-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
              >
                Descargar en Excel
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Paciente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Servicio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Doctor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Asistente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Abono
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Descuento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Valor Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Es Paciente Propio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Porcentaje
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Método de Pago
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Método de Pago Abono
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Valor Pagado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Notas
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {liquidacion.servicios.map((registro, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.paciente}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.nombre_serv}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.nombre_doc || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.nombre_aux || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCOP(registro.abono)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCOP(registro.dcto)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCOP(registro.valor_total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.es_paciente_propio ? 'Sí' : 'No'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.porcentaje !== null ? 
                          `${registro.id_porc === 3 ? 60 : registro.porcentaje}%` : 
                          (registro.es_paciente_propio ? '50%' : '40%')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.metodoPago || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.metodoPagoAbono || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        {formatCOP(registro.valor_pagado)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.notas || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default HistorialLiquidaciones;