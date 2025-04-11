import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DentalRecord } from '../types';
import { fetchDoctors, fetchAssistants, fetchServices, formatCOP } from '../data/constants';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

interface LiquidacionProps {
  registros: DentalRecord[];
  setRegistros: (registros: DentalRecord[]) => void;
}

const Liquidacion: React.FC<LiquidacionProps> = ({ registros, setRegistros }) => {
  const [doctores, setDoctores] = useState<string[]>([]);
  const [asistentes, setAsistentes] = useState<string[]>([]);
  const [servicios, setServicios] = useState<{ nombre: string; precio: number }[]>([]);
  const [doctorSeleccionado, setDoctorSeleccionado] = useState<string>('');
  const [esAuxiliar, setEsAuxiliar] = useState<boolean>(false);
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [pacienteFiltro, setPacienteFiltro] = useState<string>('');
  const [servicioFiltro, setServicioFiltro] = useState<string>('');
  const [mostrarLiquidacion, setMostrarLiquidacion] = useState(false);
  const [serviciosLiquidados, setServiciosLiquidados] = useState<DentalRecord[][]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [totalLiquidacion, setTotalLiquidacion] = useState<number>(0);
  // Cambio: Añadido estado para controlar el modo de agrupación
  const [modoAgrupacion, setModoAgrupacion] = useState<'pacienteServicio' | 'paciente' | 'ninguno'>('pacienteServicio');

  const navigate = useNavigate();
  const id_sede = localStorage.getItem('selectedSede');

  useEffect(() => {
    if (!id_sede) {
      console.log('No se encontró id_sede, redirigiendo a /sedes');
      navigate('/sedes');
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        console.log('Haciendo solicitud a /api/records con id_sede:', id_sede);
        const [doctors, assistants, services, records] = await Promise.all([
          fetchDoctors(id_sede),
          fetchAssistants(id_sede),
          fetchServices(),
          axios.get(`${import.meta.env.VITE_API_URL}/api/records`, {
            params: { id_sede },
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }),
        ]);

        setDoctores(doctors);
        setAsistentes(assistants);
        setServicios(services);
        setDoctorSeleccionado(doctors[0] || assistants[0] || '');
        setRegistros(records.data as DentalRecord[]);
      } catch (err) {
        console.error('Error al cargar los datos:', err);
        setError('Error al cargar los datos. Por favor, intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [setRegistros, id_sede, navigate]);

  useEffect(() => {
    setDoctorSeleccionado('');
  }, [esAuxiliar]);

  const pacientesUnicos = [...new Set(registros.map((registro) => registro.nombrePaciente))].sort();
  const serviciosUnicos = [...new Set(registros.map((registro) => registro.servicio))].sort();

  const registrosFiltrados = registros.filter((registro) => {
    const coincideDoctor = registro.nombreDoctor === doctorSeleccionado;
    const coincideFecha = registro.fecha >= fechaInicio && registro.fecha <= fechaFin;
    const coincidePaciente = pacienteFiltro ? registro.nombrePaciente === pacienteFiltro : true;
    const coincideServicio = servicioFiltro ? registro.servicio === servicioFiltro : true;
    return coincideDoctor && coincideFecha && coincidePaciente && coincideServicio;
  });

  // Cambio: Modificada la lógica de agrupación para soportar modos opcionales
  const agruparRegistros = (registros: DentalRecord[]): { [key: string]: DentalRecord[] } => {
    return registros.reduce(
      (acc, registro) => {
        let key: string;
        if (modoAgrupacion === 'pacienteServicio') {
          key = `${registro.nombrePaciente}-${registro.servicio}`;
        } else if (modoAgrupacion === 'paciente') {
          key = registro.nombrePaciente;
        } else {
          key = registro.id; // 'ninguno' usa el ID único para no agrupar
        }
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(registro);
        return acc;
      },
      {} as { [key: string]: DentalRecord[] }
    );
  };

  const registrosAgrupados = agruparRegistros(registrosFiltrados);
  const serviciosCompletados = Object.values(registrosAgrupados).filter((grupo) =>
    grupo.every((registro) => registro.fechaFinal !== null && registro.valor_liquidado === 0)
  );
  const serviciosPendientes = Object.values(registrosAgrupados).filter(
    (grupo) => !grupo.every((registro) => registro.fechaFinal !== null && registro.valor_liquidado === 0)
  );

  const calcularPorcentaje = (grupo: DentalRecord[]) => {
    if (esAuxiliar) {
      return grupo[0].esPacientePropio ? 0.20 : 0.10;
    }
    const idPorc = grupo[0].idPorc;
    return idPorc === 2 ? 0.50 : 0.40;
  };

  const calcularTotalGrupo = async (grupo: DentalRecord[]) => {
    const totalGrupo = grupo.reduce((sum, registro) => sum + (registro.valor_total || 0), 0);
    let porcentaje;

    if (esAuxiliar) {
      porcentaje = calcularPorcentaje(grupo);
    } else {
      const idPorc = grupo[0].idPorc;
      try {
        const { data: porcentajeData } = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/porcentajes/${idPorc}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
        porcentaje = (porcentajeData as { porcentaje: number }).porcentaje / 100;
      } catch (error) {
        console.error('Error al obtener el porcentaje:', error);
        porcentaje = idPorc === 2 ? 0.50 : 0.40;
      }
    }

    const valorLiquidado = totalGrupo * porcentaje;
    return valorLiquidado;
  };

  useEffect(() => {
    const fetchTotalLiquidacion = async () => {
      let total = 0;
      for (const grupo of serviciosCompletados) {
        const valorLiquidado = await calcularTotalGrupo(grupo);
        total += valorLiquidado;
      }
      setTotalLiquidacion(total);
    };

    fetchTotalLiquidacion();
  }, [serviciosCompletados, esAuxiliar, modoAgrupacion]);

  const handleLiquidarGrupo = async (grupo: DentalRecord[]) => {
    if (!doctorSeleccionado || !fechaInicio || !fechaFin) {
      setError('Por favor, completa todos los filtros antes de liquidar.');
      return;
    }
    try {
      const totalGrupo = await calcularTotalGrupo(grupo);
      const nuevaLiquidacion = {
        doctor: doctorSeleccionado,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        servicios: [grupo],
        totalLiquidado: totalGrupo,
        fechaLiquidacion: new Date().toISOString().split('T')[0],
      };

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/liquidations`,
        nuevaLiquidacion,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      const idsServiciosLiquidados = grupo.map((registro) => registro.id);
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/records`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        data: { ids: idsServiciosLiquidados, id_sede: parseInt(id_sede || '0', 10) },
      });

      const registrosRestantes = registros.filter(
        (registro) => !idsServiciosLiquidados.includes(registro.id)
      );
      setRegistros(registrosRestantes);
      setServiciosLiquidados([...serviciosLiquidados, grupo]);
    } catch (err) {
      console.error('Error al liquidar el grupo:', err);
      setError('Error al liquidar el grupo. Por favor, intenta de nuevo.');
    }
  };

  const handleLiquidarTodos = async () => {
    if (!doctorSeleccionado || !fechaInicio || !fechaFin) {
      setError('Por favor, completa todos los filtros antes de liquidar.');
      return;
    }
    try {
      setMostrarLiquidacion(true);
      setServiciosLiquidados(serviciosCompletados);

      const nuevaLiquidacion = {
        doctor: doctorSeleccionado,
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        servicios: serviciosCompletados,
        totalLiquidado: totalLiquidacion,
        fechaLiquidacion: new Date().toISOString().split('T')[0],
      };

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/liquidations`,
        nuevaLiquidacion,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      const idsServiciosLiquidados = serviciosCompletados.flatMap((grupo) =>
        grupo.map((registro) => registro.id)
      );
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/records`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        data: { ids: idsServiciosLiquidados, id_sede: parseInt(id_sede || '0', 10) },
      });

      const registrosRestantes = registros.filter(
        (registro) => !idsServiciosLiquidados.includes(registro.id)
      );
      setRegistros(registrosRestantes);
    } catch (err) {
      console.error('Error al liquidar:', err);
      setError('Error al liquidar los servicios. Por favor, intenta de nuevo.');
    }
  };

  const handleReiniciar = () => {
    setMostrarLiquidacion(false);
    setServiciosLiquidados([]);
  };

  const handleDescargarExcel = () => {
    const datosExcel = serviciosLiquidados.length > 0 ? serviciosLiquidados : serviciosCompletados;
    const datos = datosExcel.flatMap((grupo) => {
      const totalGrupo = grupo.reduce((sum, registro) => sum + (registro.valor_total || 0), 0);
      const sesionesCompletadas = grupo.every((registro) => registro.fechaFinal !== null)
        ? grupo[0].sesiones
        : grupo.length;
      const sesionesTotales = grupo[0].sesiones || 1;
      const porcentaje = esAuxiliar
        ? grupo[0].esPacientePropio
          ? 20
          : 10
        : grupo[0].idPorc === 2
        ? 50
        : 40;
      const totalALiquidar = totalGrupo * (porcentaje / 100);
      const metodosPago = [
        ...new Set(grupo.map((registro) => registro.metodoPago).filter((metodo) => metodo !== null)),
      ].join(', ');

      return grupo.map((registro) => ({
        'Doctor/Auxiliar': registro.nombreDoctor,
        Paciente: registro.nombrePaciente,
        Documento: registro.docId,
        Servicio: registro.servicio,
        'Progreso Sesiones': `${sesionesCompletadas}/${sesionesTotales}`,
        Abono: registro.abono || 0,
        'Método de Pago Abono': registro.metodoPagoAbono || 'N/A',
        Descuento: registro.descuento || 0,
        'Método de Pago': registro.metodoPago ? `${registro.metodoPago} (${formatCOP(registro.valor_pagado)})` : 'N/A',
        'Total Pagado': totalGrupo,
        'Valor Total': registro.valor_total,
        'Valor Restante': registro.valor_liquidado,
        'Tipo de Paciente': grupo[0].esPacientePropio
          ? esAuxiliar
            ? 'Propio (20%)'
            : 'Propio (50%)'
          : esAuxiliar
          ? 'Clínica (10%)'
          : 'Clínica (40%)',
        Porcentaje: `${porcentaje}%`,
        'Fecha Inicio': registro.fecha,
        'Fecha Final': registro.fechaFinal || 'Pendiente',
        'Total a Liquidar': totalALiquidar,
      }));
    });

    const worksheet = XLSX.utils.json_to_sheet(datos);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Liquidación');
    XLSX.writeFile(workbook, `Liquidacion_${doctorSeleccionado}_${fechaInicio}_a_${fechaFin}.xlsx`);
  };

  if (loading) {
    return <div className="text-center py-6">Cargando datos...</div>;
  }

  if (error) {
    return <div className="text-center py-6 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Liquidación - Clínica Smiley</h2>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">¿Es auxiliar?</label>
            <input
              type="checkbox"
              checked={esAuxiliar}
              onChange={(e) => setEsAuxiliar(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar {esAuxiliar ? 'Auxiliar' : 'Doctor/a'}
            </label>
            <select
              value={doctorSeleccionado}
              onChange={(e) => setDoctorSeleccionado(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Selecciona un {esAuxiliar ? 'auxiliar' : 'doctor'}</option>
              {(esAuxiliar ? asistentes : doctores).map((profesional) => (
                <option key={profesional} value={profesional}>
                  {profesional}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Paciente</label>
            <select
              value={pacienteFiltro}
              onChange={(e) => setPacienteFiltro(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Todos los Pacientes</option>
              {pacientesUnicos.map((paciente) => (
                <option key={paciente} value={paciente}>
                  {paciente}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filtrar por Servicio</label>
            <select
              value={servicioFiltro}
              onChange={(e) => setServicioFiltro(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Todos los Servicios</option>
              {serviciosUnicos.map((servicio) => (
                <option key={servicio} value={servicio}>
                  {servicio}
                </option>
              ))}
            </select>
          </div>

          {/* Cambio: Añadido selector de modo de agrupación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Modo de Agrupación</label>
            <select
              value={modoAgrupacion}
              onChange={(e) => setModoAgrupacion(e.target.value as 'pacienteServicio' | 'paciente' | 'ninguno')}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="pacienteServicio">Paciente y Servicio</option>
              <option value="paciente">Solo Paciente</option>
              <option value="ninguno">Sin Agrupar</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-100 p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-blue-900">Total a Liquidar</h3>
            <p className="text-2xl font-bold text-blue-800">{formatCOP(totalLiquidacion)}</p>
          </div>
          <div className="bg-green-100 p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-green-900">Servicios Listos</h3>
            <p className="text-2xl font-bold text-green-800">{serviciosCompletados.length}</p>
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-yellow-900">Servicios Pendientes</h3>
            <p className="text-2xl font-bold text-yellow-800">{serviciosPendientes.length}</p>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handleLiquidarTodos}
            disabled={serviciosCompletados.length === 0 || mostrarLiquidacion}
            className={`px-6 py-2 rounded-md text-white font-medium ${
              serviciosCompletados.length === 0 || mostrarLiquidacion
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            } focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200`}
          >
            Liquidar Todos los Servicios
          </button>
          {mostrarLiquidacion && (
            <button
              onClick={handleReiniciar}
              className="px-6 py-2 rounded-md text-white font-medium bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
            >
              Reiniciar Liquidación
            </button>
          )}
          {(serviciosCompletados.length > 0 || serviciosLiquidados.length > 0) && (
            <button
              onClick={handleDescargarExcel}
              className="px-6 py-2 rounded-md text-white font-medium bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
            >
              Descargar en Excel
            </button>
          )}
        </div>
      </div>

      {mostrarLiquidacion && serviciosLiquidados.length > 0 && (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Servicios Liquidados</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Doctor/Auxiliar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Paciente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Documento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Servicio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Progreso Sesiones</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Abono</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Método de Pago Abono</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Descuento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Método de Pago</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Total Pagado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Valor Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Valor Restante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Tipo de Paciente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Porcentaje</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Fecha Inicio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Fecha Final</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Total a Liquidar</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {serviciosLiquidados.flat().map((registro, index) => {
                  const grupo = serviciosLiquidados.find((g) =>
                    g.some((r) => r.id === registro.id)
                  )!;
                  const totalGrupo = grupo.reduce((sum, r) => sum + (r.valor_total || 0), 0);
                  const sesionesCompletadas = grupo.every((r) => r.fechaFinal !== null)
                    ? grupo[0].sesiones
                    : grupo.length;
                  const sesionesTotales = grupo[0].sesiones || 1;
                  const porcentaje = esAuxiliar
                    ? grupo[0].esPacientePropio
                      ? 20
                      : 10
                    : grupo[0].idPorc === 2
                    ? 50
                    : 40;
                  const totalALiquidar = totalGrupo * (porcentaje / 100);

                  return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.nombreDoctor}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.nombrePaciente}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.docId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.servicio}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{`${sesionesCompletadas}/${sesionesTotales}`}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.abono ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.metodoPagoAbono ? `${registro.metodoPagoAbono} (${formatCOP(registro.abono ?? 0)})` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.descuento ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.metodoPago ? `${registro.metodoPago} (${formatCOP(registro.valor_pagado)})` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(totalGrupo)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.valor_total ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.valor_liquidado)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {grupo[0].esPacientePropio
                          ? esAuxiliar
                            ? 'Propio (20%)'
                            : 'Propio (50%)'
                          : esAuxiliar
                          ? 'Clínica (10%)'
                          : 'Clínica (40%)'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{porcentaje}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.fecha}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.fechaFinal || 'Pendiente'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">{formatCOP(totalALiquidar)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!mostrarLiquidacion && serviciosCompletados.length > 0 && (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Servicios Listos para Liquidar</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Doctor/Auxiliar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Paciente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Documento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Servicio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Progreso Sesiones</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Abono</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Método de Pago Abono</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Descuento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Método de Pago</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Total Pagado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Valor Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Valor Restante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Tipo de Paciente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Porcentaje</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Fecha Inicio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Fecha Final</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Total a Liquidar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Acción</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {serviciosCompletados.flat().map((registro, index) => {
                  const grupo = serviciosCompletados.find((g) =>
                    g.some((r) => r.id === registro.id)
                  )!;
                  const totalGrupo = grupo.reduce((sum, r) => sum + (r.valor_total || 0), 0);
                  const sesionesCompletadas = grupo.every((r) => r.fechaFinal !== null)
                    ? grupo[0].sesiones
                    : grupo.length;
                  const sesionesTotales = grupo[0].sesiones || 1;
                  const porcentaje = esAuxiliar
                    ? grupo[0].esPacientePropio
                      ? 20
                      : 10
                    : grupo[0].idPorc === 2
                    ? 50
                    : 40;
                  const totalALiquidar = totalGrupo * (porcentaje / 100);

                  return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.nombreDoctor}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.nombrePaciente}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.docId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.servicio}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{`${sesionesCompletadas}/${sesionesTotales}`}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.abono ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.metodoPagoAbono ? `${registro.metodoPagoAbono} (${formatCOP(registro.abono ?? 0)})` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.descuento ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.metodoPago ? `${registro.metodoPago} (${formatCOP(registro.valor_pagado)})` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(totalGrupo)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.valor_total ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.valor_liquidado)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {grupo[0].esPacientePropio
                          ? esAuxiliar
                            ? 'Propio (20%)'
                            : 'Propio (50%)'
                          : esAuxiliar
                          ? 'Clínica (10%)'
                          : 'Clínica (40%)'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{porcentaje}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.fecha}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.fechaFinal || 'Pendiente'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">{formatCOP(totalALiquidar)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => handleLiquidarGrupo(grupo)} // Cambio: Pasar todo el grupo en lugar de registro individual
                          className="px-4 py-2 rounded-md text-white font-medium bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200"
                        >
                          Liquidar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {serviciosPendientes.length > 0 && (
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Servicios Pendientes de Completar</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Doctor/Auxiliar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Paciente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Documento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Servicio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Progreso Sesiones</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Abono</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Método de Pago Abono</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Descuento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[150px]">Método de Pago</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Total Pagado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Valor Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Valor Restante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Tipo de Paciente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Porcentaje</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Fecha Inicio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider min-w-[100px]">Fecha Final</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {serviciosPendientes.flat().map((registro, index) => {
                  const grupo = serviciosPendientes.find((g) =>
                    g.some((r) => r.id === registro.id)
                  )!;
                  const totalGrupo = grupo.reduce((sum, r) => sum + (r.valor_total || 0), 0);
                  const sesionesCompletadas = grupo.every((r) => r.fechaFinal !== null)
                    ? grupo[0].sesiones
                    : grupo.length;
                  const sesionesTotales = grupo[0].sesiones || 1;
                  const porcentaje = esAuxiliar
                    ? grupo[0].esPacientePropio
                      ? 20
                      : 10
                    : grupo[0].idPorc === 2
                    ? 50
                    : 40;

                  return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.nombreDoctor}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.nombrePaciente}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.docId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.servicio}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{`${sesionesCompletadas}/${sesionesTotales}`}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.abono ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.metodoPagoAbono ? `${registro.metodoPagoAbono} (${formatCOP(registro.abono ?? 0)})` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.descuento ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.metodoPago ? `${registro.metodoPago} (${formatCOP(registro.valor_pagado)})` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(totalGrupo)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.valor_total ?? 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCOP(registro.valor_liquidado)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {grupo[0].esPacientePropio
                          ? esAuxiliar
                            ? 'Propio (20%)'
                            : 'Propio (50%)'
                          : esAuxiliar
                          ? 'Clínica (10%)'
                          : 'Clínica (40%)'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{porcentaje}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.fecha}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.fechaFinal || 'Pendiente'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {registrosFiltrados.length === 0 && (
        <p className="text-gray-600 text-center mt-8">
          No hay registros que coincidan con los filtros seleccionados.
        </p>
      )}
    </div>
  );
};

export default Liquidacion;