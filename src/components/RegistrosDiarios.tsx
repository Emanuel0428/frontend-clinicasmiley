// src/components/RegistrosDiarios.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DentalRecord } from '../types';
import { formatCOP, fetchDoctors, fetchAssistants, fetchServices, fetchPaymentMethods } from '../data/constants';

interface RegistrosDiariosProps {
  registros: DentalRecord[];
  setRegistros: (registros: DentalRecord[]) => void;
}

const RegistrosDiarios: React.FC<RegistrosDiariosProps> = ({ registros, setRegistros }) => {
  const hoy = new Date().toISOString().split('T')[0];
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoy);
  const [doctores, setDoctores] = useState<string[]>([]);
  const [asistentes, setAsistentes] = useState<string[]>([]);
  const [servicios, setServicios] = useState<{ nombre: string; precio: number }[]>([]);
  const [metodosPago, setMetodosPago] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [esAuxiliar, setEsAuxiliar] = useState<boolean>(false);
  const [esPacientePropio, setEsPacientePropio] = useState<boolean>(true);
  const [aplicarDescuento, setAplicarDescuento] = useState<boolean>(false);
  const [descuentoInput, setDescuentoInput] = useState<string>('0');
  const [esPorcentaje, setEsPorcentaje] = useState<boolean>(false);
  const [aplicarAbono, setAplicarAbono] = useState<boolean>(false);
  const [abonoInput, setAbonoInput] = useState<string>('0');

  const [formData, setFormData] = useState({
    nombreDoctor: '',
    nombrePaciente: '',
    docId: '',
    servicio: '',
    abono: null as number | null,
    descuento: null as number | null,
    fecha: hoy,
    metodoPago: '',
  });

useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true);
      const [doctors, assistants, services, paymentMethods, records] = await Promise.all([
        fetchDoctors(),
        fetchAssistants(),
        fetchServices(),
        fetchPaymentMethods(), // Esto ya debería devolver los descpMetodo
        axios.get<DentalRecord[]>(`${import.meta.env.VITE_API_URL}/api/records`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }),
      ]);

      setDoctores(doctors);
      setAsistentes(assistants);
      setServicios(services);
      setMetodosPago(paymentMethods); // paymentMethods contiene los descpMetodo
      setRegistros(records.data as DentalRecord[]);

      setFormData((prev) => ({
        ...prev,
        nombreDoctor: doctors[0] || '',
        servicio: services[0]?.nombre || '',
        metodoPago: paymentMethods[0] || '',
      }));
    } catch {
      setError('Error al cargar los datos. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  loadData();
}, [setRegistros]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Calcular el descuento si es porcentaje
      let descuentoFinal: number | null = null;
      if (aplicarDescuento) {
        const descuentoValue = parseFloat(descuentoInput);
        if (esPorcentaje) {
          const servicioSeleccionado = servicios.find((s) => s.nombre === formData.servicio);
          if (servicioSeleccionado) {
            descuentoFinal = (servicioSeleccionado.precio * descuentoValue) / 100;
          }
        } else {
          descuentoFinal = descuentoValue;
        }
      }

      const newRecord = {
        nombreDoctor: formData.nombreDoctor,
        nombrePaciente: formData.nombrePaciente,
        docId: formData.docId,
        servicio: formData.servicio,
        abono: aplicarAbono ? parseFloat(abonoInput) : null,
        descuento: descuentoFinal,
        esPacientePropio: esPacientePropio,
        fecha: fechaSeleccionada,
        metodoPago: formData.metodoPago,
        esAuxiliar: esAuxiliar,
      };

      const response = await axios.post<DentalRecord>(
        `${import.meta.env.VITE_API_URL}/api/records`,
        newRecord,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      setRegistros([...registros, response.data]);
      setFormData({
        ...formData,
        nombrePaciente: '',
        docId: '',
        abono: null,
        descuento: null,
      });
      setAplicarDescuento(false);
      setDescuentoInput('0');
      setAplicarAbono(false);
      setAbonoInput('0');
      setEsPacientePropio(true);
    } catch {
      setError('Error al guardar el registro. Por favor, intenta de nuevo.');
    }
  };

  const handleDelete = async () => {
    if (selectedRecords.length === 0) {
      setError('Por favor, selecciona al menos un registro para eliminar.');
      return;
    }

    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/records`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        params: { ids: selectedRecords },
      });

      setRegistros(registros.filter((registro) => !selectedRecords.includes(registro.id)));
      setSelectedRecords([]);
    } catch {
      setError('Error al eliminar los registros. Por favor, intenta de nuevo.');
    }
  };

  const handleSelectRecord = (id: string) => {
    if (selectedRecords.includes(id)) {
      setSelectedRecords(selectedRecords.filter((recordId) => recordId !== id));
    } else {
      setSelectedRecords([...selectedRecords, id]);
    }
  };

  const registrosFiltrados = registros.filter((registro) => registro.fecha === fechaSeleccionada);

  if (loading) {
    return <div className="text-center py-6">Cargando datos...</div>;
  }

  if (error) {
    return <div className="text-center py-6 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Registros Diarios - Clínica Smiley</h2>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Fecha:</label>
          <input
            type="date"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Es auxiliar?
            </label>
            <input
              type="checkbox"
              checked={esAuxiliar}
              onChange={(e) => {
                setEsAuxiliar(e.target.checked);
                setEsPacientePropio(true); // Resetear el checkbox de paciente propio al cambiar
              }}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {esAuxiliar ? 'Auxiliar' : 'Doctor/a'}
            </label>
            <select
              value={formData.nombreDoctor}
              onChange={(e) => setFormData({ ...formData, nombreDoctor: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {(esAuxiliar ? asistentes : doctores).map((profesional) => (
                <option key={profesional} value={profesional}>
                  {profesional}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Paciente</label>
            <input
              type="text"
              value={formData.nombrePaciente}
              onChange={(e) => setFormData({ ...formData, nombrePaciente: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Documento del Paciente</label>
            <input
              type="text"
              value={formData.docId}
              onChange={(e) => setFormData({ ...formData, docId: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Servicio</label>
            <select
              value={formData.servicio}
              onChange={(e) => setFormData({ ...formData, servicio: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {servicios.map((servicio) => (
                <option key={servicio.nombre} value={servicio.nombre}>
                  {servicio.nombre} ({formatCOP(servicio.precio)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Aplicar Abono?
            </label>
            <input
              type="checkbox"
              checked={aplicarAbono}
              onChange={(e) => setAplicarAbono(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {aplicarAbono && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Abono (COP)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={abonoInput}
                  onChange={(e) => setAbonoInput(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ¿Aplicar Descuento?
            </label>
            <input
              type="checkbox"
              checked={aplicarDescuento}
              onChange={(e) => setAplicarDescuento(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {aplicarDescuento && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ¿Es porcentaje?
                </label>
                <input
                  type="checkbox"
                  checked={esPorcentaje}
                  onChange={(e) => setEsPorcentaje(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {esPorcentaje ? 'Descuento (%)' : 'Descuento (COP)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={esPorcentaje ? '0.1' : '1000'}
                    value={descuentoInput}
                    onChange={(e) => setDescuentoInput(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
            <select
              value={formData.metodoPago}
              onChange={(e) => setFormData({ ...formData, metodoPago: e.target.value })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {metodosPago.map((metodo) => (
                <option key={metodo} value={metodo}>
                  {metodo}
                </option>
              ))}
            </select>
          </div>

          {!esAuxiliar && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Paciente Propio?
              </label>
              <input
                type="checkbox"
                checked={esPacientePropio}
                onChange={(e) => setEsPacientePropio(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        <div className="mt-6">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Guardar Registro
          </button>
        </div>
      </form>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="p-4">
          <button
            onClick={handleDelete}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            disabled={selectedRecords.length === 0}
          >
            Eliminar Seleccionados ({selectedRecords.length})
          </button>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Seleccionar
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Doctor/a
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Paciente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Documento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Servicio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Abono
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descuento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Método de Pago
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Porcentaje
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {registrosFiltrados.map((registro) => (
              <tr key={registro.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <input
                    type="checkbox"
                    checked={selectedRecords.includes(registro.id)}
                    onChange={() => handleSelectRecord(registro.id)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {registro.nombreDoctor}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {registro.nombrePaciente}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {registro.docId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{registro.servicio}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {registro.abono !== null ? formatCOP(registro.abono) : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {registro.descuento !== null ? formatCOP(registro.descuento) : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {registro.metodoPago}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCOP(registro.total)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {registro.idPorc === 1 ? '40%' : registro.idPorc === 2 ? '50%' : registro.idPorc === 3 ? '10%' : registro.idPorc === 4 ? '20%' : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RegistrosDiarios;