import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DentalRecord } from '../types';
import { formatCOP, fetchDoctors, fetchAssistants, fetchServices, fetchPaymentMethods, fetchAccounts } from '../data/constants';
import { useNavigate } from 'react-router-dom';

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
  const [cuentas, setCuentas] = useState<{ id_cuenta: number; cuentas: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [esAuxiliar, setEsAuxiliar] = useState<boolean>(false);
  const [esPacientePropio, setEsPacientePropio] = useState<boolean>(false);
  const [aplicarDescuento, setAplicarDescuento] = useState<boolean>(false);
  const [descuentoInput, setDescuentoInput] = useState<string>('0');
  const [esPorcentaje, setEsPorcentaje] = useState<boolean>(false);
  const [aplicarAbono, setAplicarAbono] = useState<boolean>(false);
  const [abonoInput, setAbonoInput] = useState<string>('0');
  const [valorPagado, setValorPagado] = useState<string>('');
  const [metodoPagoAbono, setMetodoPagoAbono] = useState<string>('');
  const [idCuenta, setIdCuenta] = useState<number | null>(null);
  const [idCuentaAbono, setIdCuentaAbono] = useState<number | null>(null);
  const [montoPrestado, setMontoPrestado] = useState<string>(''); // Para Crédito
  const [titularCredito, setTitularCredito] = useState<string>(''); // Para Crédito
  const [esDatáfono, setEsDatáfono] = useState<boolean>(false); // Estado explícito para Datáfono (pago principal)
  const [esDatáfonoAbono, setEsDatáfonoAbono] = useState<boolean>(false); // Estado explícito para Datáfono (abono)

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

  const navigate = useNavigate();
  const id_sede = localStorage.getItem('selectedSede');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isAdminOrOwner = user && ['Dueño', 'Admin'].includes(user.usuario);

  useEffect(() => {
    if (!id_sede) {
      navigate('/sedes');
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const [doctors, assistants, services, paymentMethods, records, accounts] = await Promise.all([
          fetchDoctors(id_sede),
          fetchAssistants(id_sede),
          fetchServices(),
          fetchPaymentMethods(),
          axios.get(`${import.meta.env.VITE_API_URL}/api/records`, {
            params: { id_sede },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }),
          fetchAccounts(id_sede),
        ]);

        setDoctores(doctors);
        setAsistentes(assistants);
        setServicios(services);
        setMetodosPago(paymentMethods);
        setRegistros(records.data as DentalRecord[]);
        setCuentas(accounts);
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
    setFormData((prev) => ({ ...prev, nombreDoctor: '' }));
  }, [esAuxiliar]);

  useEffect(() => {
    if (!formData.metodoPago) {
      setValorPagado('');
      setIdCuenta(null);
      setMontoPrestado('');
      setTitularCredito('');
      setEsDatáfono(false);
    } else {
      setEsDatáfono(formData.metodoPago.trim().toLowerCase() === 'datáfono');
    }
  }, [formData.metodoPago]);

  useEffect(() => {
    if (!aplicarAbono || !metodoPagoAbono) {
      setMetodoPagoAbono('');
      setAbonoInput('0');
      setIdCuentaAbono(null);
      setEsDatáfonoAbono(false);
    } else {
      setEsDatáfonoAbono(metodoPagoAbono.trim().toLowerCase() === 'datáfono');
    }
  }, [aplicarAbono, metodoPagoAbono]);

  useEffect(() => {
    if (!aplicarDescuento) {
      setDescuentoInput('0');
      setEsPorcentaje(false);
    }
  }, [aplicarDescuento]);

  const resetForm = () => {
    setFormData({
      nombreDoctor: '',
      nombrePaciente: '',
      docId: '',
      servicio: '',
      abono: null,
      descuento: null,
      fecha: hoy,
      metodoPago: '',
    });
    setEsAuxiliar(false);
    setEsPacientePropio(false);
    setAplicarDescuento(false);
    setDescuentoInput('0');
    setEsPorcentaje(false);
    setAplicarAbono(false);
    setAbonoInput('0');
    setValorPagado('');
    setMetodoPagoAbono('');
    setIdCuenta(null);
    setIdCuentaAbono(null);
    setMontoPrestado('');
    setTitularCredito('');
    setEsDatáfono(false);
    setEsDatáfonoAbono(false);
    setError(''); // Cambio: Limpiar el error al resetear el formulario
  };

  const calcularDescuentoYValorTotal = () => {
    let descuentoFinal: number = 0;
    let nuevoValorTotal: number = 0;
    let abonoAjustado: number = 0;
    const servicioSeleccionado = servicios.find((s) => s.nombre === formData.servicio);

    if (servicioSeleccionado) {
      nuevoValorTotal = servicioSeleccionado.precio;

      if (aplicarDescuento) {
        const descuentoValue = parseFloat(descuentoInput) || 0;
        if (esPorcentaje) {
          descuentoFinal = (nuevoValorTotal * descuentoValue) / 100;
        } else {
          descuentoFinal = descuentoValue;
        }
        nuevoValorTotal -= descuentoFinal;
      }

      if (aplicarAbono) {
        abonoAjustado = parseFloat(abonoInput) || 0;
        if (esDatáfonoAbono) {
          abonoAjustado *= 1.00;
        }
      }

      if (esDatáfono) {
        nuevoValorTotal *= 1.00;
      }
    }

    return { descuentoFinal, nuevoValorTotal, abonoAjustado };
  };

  const { descuentoFinal, nuevoValorTotal, abonoAjustado } = calcularDescuentoYValorTotal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Cambio: Limpiar el error anterior antes de nuevas validaciones

    // Cambio: Validaciones de campos obligatorios
    if (!formData.nombreDoctor) {
      setError('Por favor, selecciona un doctor o auxiliar.');
      return;
    }
    if (!formData.nombrePaciente.trim()) {
      setError('Por favor, ingresa el nombre del paciente.');
      return;
    }
    if (!formData.docId.trim()) {
      setError('Por favor, ingresa el documento del paciente.');
      return;
    }
    if (!formData.servicio) {
      setError('Por favor, selecciona un servicio.');
      return;
    }

    // Cambio: Validaciones para abono
    if (aplicarAbono) {
      if (!metodoPagoAbono) {
        setError('Por favor, selecciona un método de pago para el abono.');
        return;
      }
      const abonoValue = parseFloat(abonoInput);
      if (isNaN(abonoValue) || abonoValue <= 0) {
        setError('El abono debe ser un valor numérico mayor a 0.');
        return;
      }
      if (metodoPagoAbono === 'Transferencia' && !idCuentaAbono) {
        setError('Por favor, selecciona una cuenta para la transferencia (abono).');
        return;
      }
    }

    // Cambio: Validaciones para descuento
    if (aplicarDescuento) {
      const descuentoValue = parseFloat(descuentoInput);
      if (isNaN(descuentoValue) || descuentoValue < 0) {
        setError('El descuento debe ser un valor numérico no negativo.');
        return;
      }
      if (esPorcentaje && (descuentoValue > 100 || descuentoValue <= 0)) {
        setError('El porcentaje de descuento debe estar entre 0 y 100.');
        return;
      }
      if (!esPorcentaje && descuentoValue > (servicios.find(s => s.nombre === formData.servicio)?.precio || 0)) {
        setError('El descuento en valor no puede superar el precio del servicio.');
        return;
      }
    }

    // Cambio: Validaciones para método de pago principal
    if (formData.metodoPago) {
      const valorPagadoNum = parseFloat(valorPagado);
      if (!valorPagado || isNaN(valorPagadoNum) || valorPagadoNum <= 0) {
        setError('Por favor, ingresa un valor pagado válido mayor a 0.');
        return;
      }
      if (formData.metodoPago === 'Transferencia' && !idCuenta) {
        setError('Por favor, selecciona una cuenta para la transferencia (valor pagado).');
        return;
      }
      if (formData.metodoPago === 'Crédito') {
        const montoPrestadoNum = parseFloat(montoPrestado);
        if (!montoPrestado || isNaN(montoPrestadoNum) || montoPrestadoNum <= 0) {
          setError('Por favor, ingresa un monto prestado válido para Crédito.');
          return;
        }
        if (!titularCredito.trim()) {
          setError('Por favor, ingresa el nombre del titular del crédito.');
          return;
        }
      }
    }

    try {
      const newRecord = {
        nombreDoctor: formData.nombreDoctor,
        nombrePaciente: formData.nombrePaciente,
        docId: formData.docId,
        servicio: formData.servicio,
        abono: aplicarAbono ? abonoAjustado : null,
        metodoPagoAbono: aplicarAbono ? metodoPagoAbono : null,
        id_cuenta_abono: aplicarAbono && metodoPagoAbono === 'Transferencia' ? idCuentaAbono : null,
        descuento: aplicarDescuento ? descuentoFinal : null,
        esPacientePropio: esPacientePropio,
        fecha: fechaSeleccionada,
        metodoPago: formData.metodoPago,
        id_cuenta: formData.metodoPago === 'Transferencia' ? idCuenta : null,
        esAuxiliar: esAuxiliar,
        id_sede: parseInt(id_sede || '0', 10),
        valorPagado: formData.metodoPago ? parseFloat(valorPagado) : null,
        montoPrestado: formData.metodoPago === 'Crédito' ? parseFloat(montoPrestado) : null,
        titularCredito: formData.metodoPago === 'Crédito' ? titularCredito : null,
        esDatáfono: esDatáfono,
        esDatáfonoAbono: aplicarAbono ? esDatáfonoAbono : null,
        valor_total: nuevoValorTotal,
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/records`,
        newRecord,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );

      setRegistros([...registros, response.data as DentalRecord]);
      setSelectedRecords([]);
      resetForm();
    } catch (err) {
      console.error('Error al guardar el registro:', err);
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
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        data: { ids: selectedRecords, id_sede: parseInt(id_sede || '0', 10) },
      });

      setRegistros(registros.filter((registro) => !selectedRecords.includes(registro.id)));
      setSelectedRecords([]);
    } catch (err) {
      console.error('Error al eliminar los registros:', err);
      setError('Error al eliminar los registros. Por favor, intenta de nuevo.');
    }
  };

  const handleSelectRecord = (id: string) => {
    setSelectedRecords((prev) =>
      prev.includes(id) ? prev.filter((recordId) => recordId !== id) : [...prev, id]
    );
  };

  const registrosFiltrados = registros.filter((registro) => registro.fecha === fechaSeleccionada);

  if (loading) return <div className="text-center py-6">Cargando datos...</div>;

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

      {/* Cambio: Mostrar mensaje de error en la UI */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">¿Es auxiliar?</label>
            <input
              type="checkbox"
              checked={esAuxiliar}
              onChange={(e) => {
                setEsAuxiliar(e.target.checked);
                setEsPacientePropio(false);
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
              required
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Paciente</label>
            <input
              type="text"
              value={formData.nombrePaciente}
              onChange={(e) => setFormData({ ...formData, nombrePaciente: e.target.value.trim() })} // Cambio: Trim para evitar espacios en blanco
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Documento del Paciente</label>
            <input
              type="text"
              value={formData.docId}
              onChange={(e) => setFormData({ ...formData, docId: e.target.value.trim() })} // Cambio: Trim para evitar espacios en blanco
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
              required
            >
              <option value="">Selecciona un servicio</option>
              {servicios.map((servicio) => (
                <option key={servicio.nombre} value={servicio.nombre}>
                  {servicio.nombre} ({formatCOP(servicio.precio)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">¿Aplicar Abono?</label>
            <input
              type="checkbox"
              checked={aplicarAbono}
              onChange={(e) => setAplicarAbono(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {aplicarAbono && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago (Abono)</label>
                <select
                  value={metodoPagoAbono}
                  onChange={(e) => setMetodoPagoAbono(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecciona un método de pago</option>
                  {metodosPago.map((metodo) => (
                    <option key={metodo} value={metodo}>
                      {metodo}
                    </option>
                  ))}
                </select>

                {metodoPagoAbono && (
                  <>
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Abono (COP)</label>
                      <div className="flex items-center space-x-4">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={abonoInput}
                          onChange={(e) => setAbonoInput(e.target.value)}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          required
                        />
                        {esDatáfonoAbono && (
                          <span className="text-sm text-gray-600">
                            Abono Ajustado: {formatCOP(abonoAjustado)}
                          </span>
                        )}
                      </div>
                    </div>

                    {metodoPagoAbono === 'Transferencia' && (
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cuenta (Abono)</label>
                        <select
                          value={idCuentaAbono || ''}
                          onChange={(e) => setIdCuentaAbono(parseInt(e.target.value))}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          required
                        >
                          <option value="">Selecciona una cuenta</option>
                          {cuentas.map((cuenta) => (
                            <option key={cuenta.id_cuenta} value={cuenta.id_cuenta}>
                              {cuenta.cuentas}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">¿Aplicar Descuento?</label>
            <input
              type="checkbox"
              checked={aplicarDescuento}
              onChange={(e) => setAplicarDescuento(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            {aplicarDescuento && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">¿Es porcentaje?</label>
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
                  <div className="flex items-center space-x-4">
                    <input
                      type="number"
                      min="0"
                      step={esPorcentaje ? '0.1' : '1000'}
                      value={descuentoInput}
                      onChange={(e) => setDescuentoInput(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                    {formData.servicio && (
                      <span className="text-sm text-gray-600">
                        Nuevo Valor Total: {formatCOP(nuevoValorTotal)}
                      </span>
                    )}
                  </div>
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
              <option value="">Selecciona un método de pago</option>
              {metodosPago.map((metodo) => (
                <option key={metodo} value={metodo}>
                  {metodo}
                </option>
              ))}
            </select>
            {formData.metodoPago && (
              <>
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor Pagado (COP)</label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={valorPagado}
                      onChange={(e) => setValorPagado(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                    {formData.servicio && (
                      <span className="text-sm text-gray-600">
                        Nuevo Valor del Servicio: {formatCOP(nuevoValorTotal)}
                      </span>
                    )}
                  </div>
                </div>
                {formData.metodoPago === 'Transferencia' && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cuenta (Valor Pagado)</label>
                    <select
                      value={idCuenta || ''}
                      onChange={(e) => setIdCuenta(parseInt(e.target.value))}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecciona una cuenta</option>
                      {cuentas.map((cuenta) => (
                        <option key={cuenta.id_cuenta} value={cuenta.id_cuenta}>
                          {cuenta.cuentas}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {formData.metodoPago === 'Crédito' && (
                  <>
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Monto Prestado (COP)</label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={montoPrestado}
                        onChange={(e) => setMontoPrestado(e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Titular del Crédito</label>
                      <input
                        type="text"
                        value={titularCredito}
                        onChange={(e) => setTitularCredito(e.target.value.trim())} // Cambio: Trim para evitar espacios en blanco
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {!esAuxiliar && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">¿Paciente Propio?</label>
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

      <div className="bg-white shadow-md rounded-lg">
        <div className="p-4">
          {isAdminOrOwner && (
            <button
              onClick={handleDelete}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-red-300"
              disabled={selectedRecords.length === 0}
            >
              Eliminar Seleccionados ({selectedRecords.length})
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Seleccionar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  Doctor/Auxiliar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  Paciente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Documento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  Servicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Abono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  Método de Pago Abono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Descuento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  Método de Pago
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Valor Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Valor Restante
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Fecha Inicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Fecha Final
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {registrosFiltrados.map((registro) => (
                <tr key={registro.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {registro.servicio}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCOP(registro.abono ?? 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {registro.metodoPagoAbono ? `${registro.metodoPagoAbono} (${formatCOP(registro.abono ?? 0)})` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCOP(registro.descuento ?? 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {registro.metodoPago ? `${registro.metodoPago} (${formatCOP(registro.valor_pagado)})` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCOP(registro.valor_total ?? 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCOP(registro.valor_liquidado)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {registro.fecha}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {registro.fechaFinal || 'Pendiente'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RegistrosDiarios;