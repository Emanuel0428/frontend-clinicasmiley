import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { DentalRecord } from '../types';
import { formatCOP, fetchDoctors, fetchAssistants, fetchServices, fetchStadiumServices, fetchPaymentMethods, fetchAccounts, fetchCajaBase, updateCajaBase } from '../data/constants';
import { useNavigate } from 'react-router-dom';

interface RegistrosDiariosProps {
  registros: DentalRecord[];
  setRegistros: (registros: DentalRecord[]) => void;
}

interface FormData {
  nombreDoctor: string;
  nombrePaciente: string;
  docId: string;
  servicio: string[];
  abono: number | null;
  descuento: number | null;
  fecha: string;
  metodoPago: string;
  notas?: string;
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
  const [usarPreciosEstadio, setUsarPreciosEstadio] = useState<boolean>(true);
  const [tabs, setTabs] = useState<FormData[]>([
    {
      nombreDoctor: '',
      nombrePaciente: '',
      docId: '',
      servicio: [''],
      abono: null,
      descuento: null,
      fecha: hoy,
      metodoPago: '',
      notas: '',
    },
  ]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [esAuxiliar, setEsAuxiliar] = useState<boolean>(false);
  const [esPacientePropio, setEsPacientePropio] = useState<boolean>(false);
  const [aplicarDescuento, setAplicarDescuento] = useState<boolean>(false);
  const [descuentoInput, setDescuentoInput] = useState<string>('0');
  const [esPorcentaje, setEsPorcentaje] = useState<boolean>(false);
  const [aplicarAbono, setAplicarAbono] = useState<boolean>(false);
  const [abonoInput, setAbonoInput] = useState<string>('0');
  const [valorPagado, setValorPagado] = useState<string>('0');
  const [metodoPagoAbono, setMetodoPagoAbono] = useState<string>('');
  const [idCuenta, setIdCuenta] = useState<number | null>(null);
  const [idCuentaAbono, setIdCuentaAbono] = useState<number | null>(null);
  const [montoPrestado, setMontoPrestado] = useState<string>('0');
  const [titularCredito, setTitularCredito] = useState<string>('');
  const [esDatáfono, setEsDatáfono] = useState<boolean>(false);
  const [esDatáfonoAbono, setEsDatáfonoAbono] = useState<boolean>(false);
  const [pacientesCoincidentes, setPacientesCoincidentes] = useState<
    { paciente: string; doc_id: string; tot_abono: number }[]
  >([]);
  const [mostrarListaPacientes, setMostrarListaPacientes] = useState<boolean>(false);
  const [saldoAFavor, setSaldoAFavor] = useState<number>(0);
  const [baseEfectivo, setBaseEfectivo] = useState<number>(0);
  const [loadingBase, setLoadingBase] = useState<boolean>(false);
  const [errorBase, setErrorBase] = useState<string>('');
  const [baseInput, setBaseInput] = useState<string>('0');
  const [serviciosPendientes, setServiciosPendientes] = useState<{[key: string]: DentalRecord[]}>({});
  const [seleccionadoServicioPendiente, setSeleccionadoServicioPendiente] = useState<DentalRecord | null>(null);
  const [mostrarServiciosPendientes, setMostrarServiciosPendientes] = useState<boolean>(false);

  const serviciosAuxiliarPermitidos = [
  'Sesión de aclaramiento',
  'Limpieza profunda',
  'Promoción aclaramiento',
];

  const MAX_SERVICES = 30;
  const MAX_TABS = 10;

  const navigate = useNavigate();
  const id_sede = localStorage.getItem('selectedSede');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isAdminOrOwner = user && ['Dueño', 'Admin'].includes(user.usuario);

  const formatNumberInput = (value: string): string => {
    if (!value || value === '0') return '0';
    const cleanValue = value.replace(/[^0-9]/g, '');
    const numberValue = parseInt(cleanValue, 10);
    if (isNaN(numberValue)) return '0';
    return numberValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const parseNumberInput = (value: string): number => {
    return parseFloat(value.replace(/\./g, '')) || 0;
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur();
  };

  const loadCajaBase = useCallback(async () => {
    if (id_sede) {
      setLoadingBase(true);
      setErrorBase('');
      try {
        const base = await fetchCajaBase(id_sede);
        setBaseEfectivo(base);
        setBaseInput(formatNumberInput(base.toString()));
      } catch (err) {
        console.error("Failed to load caja base", err);
        setErrorBase("Error al cargar la base de efectivo.");
        setBaseEfectivo(0);
        setBaseInput('0');
      } finally {
        setLoadingBase(false);
      }
    }
  }, [id_sede]);

  useEffect(() => {
    loadCajaBase();
  }, [loadCajaBase]);

  useEffect(() => {
    if (!id_sede) {
      navigate('/sedes');
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        
        let servicesData;
        if (id_sede === '2') {
          servicesData = usarPreciosEstadio ? await fetchStadiumServices() : await fetchServices();
        } else {
          servicesData = await fetchServices();
        }
        
        const [doctors, assistants, paymentMethods, records, accounts] = await Promise.all([
          fetchDoctors(id_sede),
          fetchAssistants(id_sede),
          fetchPaymentMethods(),
          axios.get(`${import.meta.env.VITE_API_URL}/api/records`, {
            params: { id_sede },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          }),
          fetchAccounts(id_sede),
        ]);

        setDoctores(doctors);
        setAsistentes(assistants);
        setServicios(servicesData);
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
  }, [setRegistros, id_sede, navigate, usarPreciosEstadio]);

  useEffect(() => {
    updateTab(activeTab, (prev) => ({ ...prev, nombreDoctor: '' }));
    if (esAuxiliar) {
      updateTab(activeTab, (prev) => ({
        ...prev,
        servicio: prev.servicio.map((s) =>
          serviciosAuxiliarPermitidos.includes(s) ? s : ''
        ),
      }));
    }
  }, [esAuxiliar]);

  useEffect(() => {
    const metodoPago = tabs[activeTab].metodoPago;
    if (!metodoPago) {
      setValorPagado('0');
      setIdCuenta(null);
      setMontoPrestado('0');
      setTitularCredito('');
      setEsDatáfono(false);
    } else {
      setEsDatáfono(metodoPago.trim().toLowerCase() === 'datáfono');
    }
  }, [tabs, activeTab]);

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

  const updateTab = (tabIndex: number, update: (prev: FormData) => FormData) => {
    setTabs((prevTabs) => {
      const newTabs = [...prevTabs];
      newTabs[tabIndex] = update(newTabs[tabIndex]);
      return newTabs;
    });
  };

  const addTab = () => {
    if (tabs.length >= MAX_TABS) {
      setError('No puedes agregar más pestañas. Máximo permitido: ' + MAX_TABS);
      return;
    }
    setTabs((prevTabs) => [
      ...prevTabs,
      {
        nombreDoctor: '',
        nombrePaciente: '',
        docId: '',
        servicio: [''],
        abono: null,
        descuento: null,
        fecha: hoy,
        metodoPago: '',
      },
    ]);
    setActiveTab(tabs.length);
    resetStates();
  };

  const removeTab = (tabIndex: number) => {
    if (tabs.length === 1) {
      setError('No puedes eliminar la última pestaña.');
      return;
    }
    setTabs((prevTabs) => prevTabs.filter((_, index) => index !== tabIndex));
    setActiveTab((prev) => {
      if (prev === tabIndex) {
        return Math.max(0, prev - 1);
      }
      return prev > tabIndex ? prev - 1 : prev;
    });
    resetStates();
  };

  const addService = () => {
    const currentServices = tabs[activeTab].servicio;
    if (currentServices.length >= MAX_SERVICES) {
      setError('No puedes agregar más servicios. Máximo permitido: ' + MAX_SERVICES);
      return;
    }
    updateTab(activeTab, (prev) => ({
      ...prev,
      servicio: [...prev.servicio, ''],
    }));
  };

  const removeService = (serviceIndex: number) => {
    const currentServices = tabs[activeTab].servicio;
    if (currentServices.length === 1) {
      setError('No puedes eliminar el último servicio.');
      return;
    }
    updateTab(activeTab, (prev) => ({
      ...prev,
      servicio: prev.servicio.filter((_, index) => index !== serviceIndex),
    }));
  };

  const updateService = (serviceIndex: number, value: string) => {
    updateTab(activeTab, (prev) => {
      const newServices = [...prev.servicio];
      newServices[serviceIndex] = value;
      return { ...prev, servicio: newServices };
    });
  };

  const buscarPacientes = async (nombre: string) => {
    if (nombre.length < 2) {
      setPacientesCoincidentes([]);
      setMostrarListaPacientes(false);
      return;
    }

    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/patients/search`, {
        params: { nombre },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setPacientesCoincidentes(response.data as { paciente: string; doc_id: string; tot_abono: number }[]);
      setMostrarListaPacientes(true);
    } catch (err) {
      console.error('Error al buscar pacientes:', err);
      setError('Error al buscar pacientes. Por favor, intenta de nuevo.');
    }
  };

  const seleccionarPaciente = (paciente: { paciente: string; doc_id: string; tot_abono: number }) => {
    updateTab(activeTab, (prev) => ({
      ...prev,
      nombrePaciente: paciente.paciente,
      docId: paciente.doc_id,
      servicio: prev.servicio,
    }));
    setSaldoAFavor(paciente.tot_abono || 0);
    setPacientesCoincidentes([]);
    setMostrarListaPacientes(false);
    
    // Buscamos inmediatamente servicios pendientes para este paciente
    cargarServiciosPendientes(paciente.doc_id);
  };

  const resetStates = () => {
    setEsAuxiliar(false);
    setEsPacientePropio(false);
    setAplicarDescuento(false);
    setDescuentoInput('0');
    setEsPorcentaje(false);
    setAplicarAbono(false);
    setAbonoInput('0');
    setValorPagado('0');
    setMetodoPagoAbono('');
    setIdCuenta(null);
    setIdCuentaAbono(null);
    setMontoPrestado('0');
    setTitularCredito('');
    setEsDatáfono(false);
    setEsDatáfonoAbono(false);
    setSaldoAFavor(0);
    setPacientesCoincidentes([]);
    setMostrarListaPacientes(false);
  };

  const resetForm = () => {
    setTabs([
      {
        nombreDoctor: '',
        nombrePaciente: '',
        docId: '',
        servicio: [''],
        abono: null,
        descuento: null,
        fecha: hoy,
        metodoPago: '',
        notas: '',
      },
    ]);
    setActiveTab(0);
    resetStates();
  };

  const calcularValores = (serviciosSeleccionados: string[]) => {
    let valorTotal = 0;
    let descuentoFinal = 0;
    let nuevoValorServicio = 0;
    let abonoAjustado = 0;

    const currentTab = tabs[activeTab];
    serviciosSeleccionados.forEach((servicioNombre) => {
      const servicioSeleccionado = servicios.find((s) => s.nombre === servicioNombre);
      if (servicioSeleccionado) {
        const ongoingService = registros.find(
          (record) =>
            record.docId === currentTab.docId &&
            record.servicio === servicioNombre &&
            !record.fechaFinal
        );

        if (ongoingService) {
          nuevoValorServicio += ongoingService.valor_liquidado;
          valorTotal += ongoingService.valor_total || 0;
        } else {
          nuevoValorServicio += servicioSeleccionado.precio;
          valorTotal += servicioSeleccionado.precio;
        }
      }
    });

    nuevoValorServicio -= saldoAFavor;
    if (nuevoValorServicio < 0) {
      nuevoValorServicio = 0;
    }

    if (aplicarDescuento) {
      const descuentoValue = parseNumberInput(descuentoInput);
      if (esPorcentaje) {
        descuentoFinal = (valorTotal * descuentoValue) / 100;
      } else {
        descuentoFinal = descuentoValue;
      }
      nuevoValorServicio -= descuentoFinal;
      if (nuevoValorServicio < 0) {
        nuevoValorServicio = 0;
      }
    }

    if (aplicarAbono) {
      abonoAjustado = parseNumberInput(abonoInput);
      if (esDatáfonoAbono) {
        abonoAjustado *= 1.05; 
      }
    }

    if (esDatáfono) {
      nuevoValorServicio *= 1.05;
    }

    return { valorTotal, descuentoFinal, nuevoValorServicio, abonoAjustado };
  };

  const fetchUpdatedRecords = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/records`, {
        params: { id_sede },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setRegistros(response.data as DentalRecord[]);
    } catch (err) {
      console.error('Error al actualizar los registros:', err);
      setError('Error al actualizar los registros. Por favor, intenta de nuevo.');
    }
  };

  const cargarServiciosPendientes = useCallback(async (docId: string) => {
    if (!docId) {
      setServiciosPendientes({});
      return;
    }

    try {
      console.log("Buscando servicios pendientes para el documento:", docId);
      
      // Filtramos registros con valor_liquidado > 0 (tiene saldo pendiente)
      const serviciosPendientesTemp = registros.filter(
        (registro) => 
          registro.docId === docId && 
          registro.valor_liquidado > 0 &&
          !registro.fechaFinal
      );

      if (serviciosPendientesTemp.length > 0) {
        console.log(`Se encontraron ${serviciosPendientesTemp.length} servicios pendientes`);
      } else {
        console.log("No se encontraron servicios pendientes");
      }

      // Agrupamos por servicio para combinar múltiples registros del mismo servicio
      const agrupados = serviciosPendientesTemp.reduce((acc, registro) => {
        const key = registro.servicio;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(registro);
        return acc;
      }, {} as {[key: string]: DentalRecord[]});

      Object.entries(agrupados).forEach(([servicio, registros]) => {
        console.log(`Servicio pendiente: ${servicio}, Monto: ${formatCOP(registros[0]?.valor_liquidado || 0)}`);
      });

      setServiciosPendientes(agrupados);
      // Si hay servicios pendientes, los mostramos automáticamente
      if (Object.keys(agrupados).length > 0) {
        console.log("Mostrando automáticamente servicios pendientes");
      }

    } catch (error) {
      console.error("Error al cargar servicios pendientes:", error);
      setServiciosPendientes({});
    }
  }, [registros]);

  // Cuando cambia el documento del paciente, cargamos sus servicios pendientes
  useEffect(() => {
    const currentTabData = tabs[activeTab];
    if (currentTabData.docId) {
      cargarServiciosPendientes(currentTabData.docId);
    }
  }, [tabs, activeTab, cargarServiciosPendientes]);

  const seleccionarServicioPendiente = (servicio: string) => {
    if (!serviciosPendientes[servicio]?.length) return;
    
    const registro = serviciosPendientes[servicio][0];
    setSeleccionadoServicioPendiente(registro);
    
    updateTab(activeTab, (prev) => ({
      ...prev,
      servicio: [servicio],
      nombrePaciente: registro.nombrePaciente,
      docId: registro.docId,
      nombreDoctor: registro.nombreDoctor,
    }));

    // Establecemos automáticamente el valor pendiente como valor a pagar
    setValorPagado(registro.valor_liquidado.toString());
    
    // Hacemos scroll a la sección de método de pago para facilitar la completación
    setTimeout(() => {
      const metodoPagoElement = document.querySelector('[name="metodoPago"]');
      if (metodoPagoElement) {
        metodoPagoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const currentTab = tabs[activeTab];
      if (!id_sede || isNaN(parseInt(id_sede, 10))) {
        setError('Por favor, selecciona una sede válida.');
        return;
      }
      if (currentTab.metodoPago && !parseNumberInput(valorPagado)) {
        setError('Por favor, ingresa el valor pagado.');
        return;
      }
      if (aplicarAbono && !metodoPagoAbono) {
        setError('Por favor, selecciona un método de pago para el abono.');
        return;
      }
      if (currentTab.metodoPago === 'Transferencia' && !idCuenta) {
        setError('Por favor, selecciona una cuenta para la transferencia (valor pagado).');
        return;
      }
      if (aplicarAbono && metodoPagoAbono === 'Transferencia' && !idCuentaAbono) {
        setError('Por favor, selecciona una cuenta para la transferencia (abono).');
        return;
      }
      if (currentTab.metodoPago === 'Crédito') {
        if (!parseNumberInput(montoPrestado) || parseNumberInput(montoPrestado) <= 0) {
          setError('Por favor, ingresa un monto prestado válido para Crédito.');
          return;
        }
        if (!titularCredito) {
          setError('Por favor, ingresa el nombre del titular del crédito para Crédito.');
          return;
        }
      }

      if (seleccionadoServicioPendiente) {
        const registroId = seleccionadoServicioPendiente.id;
        const valorPagadoNum = parseNumberInput(valorPagado);
        
        console.log(`Completando pago pendiente para servicio: ${seleccionadoServicioPendiente.servicio}`);
        console.log(`Valor pendiente actual: ${formatCOP(seleccionadoServicioPendiente.valor_liquidado)}`);
        console.log(`Valor a pagar ahora: ${formatCOP(valorPagadoNum)}`);
        
        // Verificamos si el pago actual completa el servicio
        const completa = valorPagadoNum >= seleccionadoServicioPendiente.valor_liquidado;
        
        // Preparamos los datos a actualizar
        const payload: Record<string, any> = {
          id: registroId,
          // Acumulamos el valor pagado
          valor_pagado: seleccionadoServicioPendiente.valor_pagado + valorPagadoNum,
          // Si completa el pago, ponemos el valor_liquidado en 0, sino restamos lo pagado
          valor_liquidado: completa ? 0 : seleccionadoServicioPendiente.valor_liquidado - valorPagadoNum,
          // Si completa el pago, actualizamos la fecha final
          fechaFinal: completa ? fechaSeleccionada : null,
          id_metodo: null
        };
        
        console.log(`¿Pago completo? ${completa ? 'SÍ' : 'NO'}`);
        console.log(`Nuevo valor pagado: ${formatCOP(payload.valor_pagado)}`);
        console.log(`Valor restante: ${formatCOP(payload.valor_liquidado)}`);
        
        // Obtenemos el id del método de pago
        if (currentTab.metodoPago) {
          try {
            const response = await axios.get(
              `${import.meta.env.VITE_API_URL}/api/metodos-pago`,
              {
                params: { nombre: currentTab.metodoPago },
                headers: {
                  Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
              }
            );
            // Tipamos correctamente la respuesta para manejar el id_metodo
            interface MetodoPago {
              id_metodo: number;
              [key: string]: any;
            }
            
            if (response.data && typeof response.data === 'object') {
              const metodoPago = response.data as MetodoPago;
              if ('id_metodo' in metodoPago) {
                payload.id_metodo = metodoPago.id_metodo;
              }
            }
          } catch (error) {
            console.error('Error al obtener ID de método de pago:', error);
          }
        }
        
        console.log('Actualizando servicio pendiente en la base de datos:', payload);
        
        try {
          const updateResponse = await axios.put(
            `${import.meta.env.VITE_API_URL}/api/records/${registroId}`,
            payload,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
              },
            }
          );
          
          console.log('Servicio actualizado correctamente:', updateResponse.data);
          
          // Actualizamos la lista de registros
          await fetchUpdatedRecords();
          // Limpiamos el servicio seleccionado
          setSeleccionadoServicioPendiente(null);
          // Reseteamos el formulario
          resetForm();
          
          // Si el pago fue en efectivo, actualizamos la base de efectivo
          if (currentTab.metodoPago === 'Efectivo') {
            let newBaseEfectivo = baseEfectivo + valorPagadoNum;
            try {
              const updatedBase = await updateCajaBase(id_sede, newBaseEfectivo);
              setBaseEfectivo(updatedBase);
              setBaseInput(formatNumberInput(updatedBase.toString()));
            } catch (err) {
              console.error('Error al actualizar la base de efectivo:', err);
              setErrorBase('Error al actualizar la base de efectivo.');
            }
          }
          
          // Mostramos alerta de éxito
          alert(`Pago ${completa ? 'completado' : 'parcial'} registrado con éxito para el servicio: ${seleccionadoServicioPendiente.servicio}. ${completa ? 'El servicio ha sido marcado como completado.' : 'Aún queda un saldo pendiente de ' + formatCOP(payload.valor_liquidado)}`);
          
          return;
        } catch (error) {
          console.error('Error al actualizar el servicio pendiente:', error);
          setError('Error al actualizar el servicio pendiente. Por favor, intenta de nuevo.');
          return;
        }
      }

      const { valorTotal, descuentoFinal, nuevoValorServicio, abonoAjustado } = calcularValores(currentTab.servicio);

      const serviciosValidos = currentTab.servicio.filter((s) => s);
      if (serviciosValidos.length === 0) {
        setError('Por favor, selecciona al menos un servicio válido.');
        return;
      }

      const serviciosPayload = serviciosValidos.map((servicio) => {
        const servicioData = servicios.find((s) => s.nombre === servicio);
        if (!servicioData) {
          throw new Error('Servicio no encontrado.');
        }
        const ongoingService = registros.find(
          (record) =>
            record.docId === currentTab.docId &&
            record.servicio === servicio &&
            !record.fechaFinal
        );
        return {
          servicio,
          valor_total: ongoingService ? ongoingService.valor_total : servicioData.precio,
          valor_liquidado: ongoingService ? ongoingService.valor_liquidado : servicioData.precio,
        };
      });

      const payload = {
        nombreDoctor: currentTab.nombreDoctor,
        nombrePaciente: currentTab.nombrePaciente,
        docId: currentTab.docId,
        servicios: serviciosPayload,
        abono: aplicarAbono ? abonoAjustado : null,
        metodoPagoAbono: aplicarAbono ? metodoPagoAbono : null,
        id_cuenta_abono: aplicarAbono && metodoPagoAbono === 'Transferencia' ? idCuentaAbono : null,
        descuento: aplicarDescuento ? descuentoFinal : null,
        esPacientePropio: esPacientePropio,
        fecha: fechaSeleccionada,
        metodoPago: currentTab.metodoPago,
        id_cuenta: currentTab.metodoPago === 'Transferencia' ? idCuenta : null,
        esAuxiliar: esAuxiliar,
        id_sede: parseInt(id_sede, 10),
        valorPagado: currentTab.metodoPago ? parseNumberInput(valorPagado) : null,
        montoPrestado: currentTab.metodoPago === 'Crédito' ? parseNumberInput(montoPrestado) : null,
        titularCredito: currentTab.metodoPago === 'Crédito' ? titularCredito : null,
        esDatáfono: esDatáfono,
        esDatáfonoAbono: aplicarAbono ? esDatáfonoAbono : null,
        notas : currentTab.notas || null,
      };

      console.log('Enviando payload:', payload);

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/records`,
        payload,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );

      const newRecords = Array.isArray(response.data) ? response.data : [response.data];
      await fetchUpdatedRecords();

      if (payload.metodoPago === 'Efectivo' || payload.metodoPagoAbono === 'Efectivo') {
        let newBaseEfectivo = baseEfectivo;
        if (payload.metodoPago === 'Efectivo' && payload.valorPagado) {
          newBaseEfectivo += payload.valorPagado;
        }
        if (payload.metodoPagoAbono === 'Efectivo' && payload.abono) {
          newBaseEfectivo += payload.abono;
        }
        try {
          const updatedBase = await updateCajaBase(id_sede, newBaseEfectivo);
          setBaseEfectivo(updatedBase);
          setBaseInput(formatNumberInput(updatedBase.toString()));
        } catch (err) {
          console.error('Error al actualizar la base de efectivo:', err);
          setErrorBase('Error al actualizar la base de efectivo.');
        }
      }

      setSelectedRecords([]);
      resetForm();
    } catch (err) {
      console.error('Error al guardar el registro:', err);
      setError('Error al guardar el registro. Por favor, intenta de nuevo.');
    }
  };

  const handleUpdateBase = async () => {
    if (!isAdminOrOwner || !id_sede) return;

    const newBaseValue = parseNumberInput(baseInput);
    if (isNaN(newBaseValue)) {
      setErrorBase("Por favor, ingresa un número válido para la base.");
      return;
    }

    setLoadingBase(true);
    setErrorBase('');
    try {
      const updatedBase = await updateCajaBase(id_sede, newBaseValue);
      setBaseEfectivo(updatedBase);
      setBaseInput(formatNumberInput(updatedBase.toString()));
      setErrorBase("¡Base actualizada correctamente!");
      setTimeout(() => setErrorBase(''), 3000);
    } catch (err) {
      console.error("Failed to update caja base", err);
      setErrorBase("Error al actualizar la base.");
    } finally {
      setLoadingBase(false);
    }
  };

  const handleDelete = async () => {
    if (selectedRecords.length === 0) {
      setError('Por favor, selecciona al menos un registro para eliminar.');
      return;
    }

    try {
      await axios({
        method: 'DELETE',
        url: `${import.meta.env.VITE_API_URL}/api/records`,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        data: { ids: selectedRecords, id_sede: parseInt(id_sede || '0', 10) }
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
  if (error && !loadingBase && !errorBase) return <div className="text-center py-6 text-red-500">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">Registros Diarios - Clínica Smiley</h2>
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

      {id_sede === '2' && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-medium text-blue-800 mb-2">Precios Sede Estadio</h3>
          <div className="flex items-center">
            <div className="flex items-center mr-4">
              <input
                id="precios-estadio"
                type="radio"
                checked={usarPreciosEstadio}
                onChange={() => setUsarPreciosEstadio(true)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="precios-estadio" className="ml-2 text-sm font-medium text-gray-700">
                Usar precios de Estadio
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="precios-estandar"
                type="radio"
                checked={!usarPreciosEstadio}
                onChange={() => setUsarPreciosEstadio(false)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="precios-estandar" className="ml-2 text-sm font-medium text-gray-700">
                Usar precios estándar de la clínica
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center space-x-1 border-b border-gray-200 ">
          {tabs.map((_, index) => (
            <div key={index} className="relative flex items-center">
              <button
                onClick={() => {
                  setActiveTab(index);
                  resetStates();
                }}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
                  activeTab === index
                    ? 'bg-white text-teal-700 border border-b-0 border-gray-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Registro {index + 1}
                {tabs.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTab(index);
                    }}
                    className="ml-2 text-gray-500 hover:text-red-600 cursor-pointer"
                  >
                    ×
                  </span>
                )}
                {activeTab === index && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-teal-600 to-teal-700"></span>
                )}
              </button>
            </div>
          ))}
          {tabs.length < MAX_TABS && (
            <button
              onClick={addTab}
              className="flex items-center justify-center px-2 py-1 text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-teal-700 rounded-t-lg hover:bg-blue-700 transition-all duration-200"
            >
              +
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-5 mb-6 border border-teal-200">
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
              value={tabs[activeTab].nombreDoctor}
              onChange={(e) => updateTab(activeTab, (prev) => ({ ...prev, nombreDoctor: e.target.value }))}
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

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Paciente</label>
            <input
              type="text"
              value={tabs[activeTab].nombrePaciente}
              onChange={(e) => {
                updateTab(activeTab, (prev) => ({ ...prev, nombrePaciente: e.target.value }));
                buscarPacientes(e.target.value);
              }}
              onFocus={() => setMostrarListaPacientes(true)}
              onBlur={() => setTimeout(() => setMostrarListaPacientes(false), 200)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
            {mostrarListaPacientes && pacientesCoincidentes.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {pacientesCoincidentes.map((paciente) => (
                  <li
                    key={paciente.doc_id}
                    onClick={() => seleccionarPaciente(paciente)}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  >
                    {paciente.paciente} | {paciente.doc_id}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Documento del Paciente</label>
            <input
              type="text"
              value={tabs[activeTab].docId}
              onChange={(e) => updateTab(activeTab, (prev) => ({ ...prev, docId: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Servicios</label>
            {tabs[activeTab].servicio.map((servicio, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <select
                  value={servicio}
                  onChange={(e) => updateService(index, e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="">Selecciona un servicio</option>
                  {(esAuxiliar
                    ? servicios.filter((s) => serviciosAuxiliarPermitidos.includes(s.nombre))
                    : servicios
                  ).map((s) => {
                    const ongoingService = registros.find(
                      (record) =>
                        record.docId === tabs[activeTab].docId &&
                        record.servicio === s.nombre &&
                        !record.fechaFinal
                    );
                    return (
                      <option key={s.nombre} value={s.nombre}>
                        {s.nombre} ({formatCOP(ongoingService ? ongoingService.valor_liquidado : s.precio)})
                      </option>
                    );
                  })}
                </select>
                {tabs[activeTab].servicio.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeService(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    -
                  </button>
                )}
              </div>
            ))}
            {tabs[activeTab].servicio.length < MAX_SERVICES && (
              <button
                type="button"
                onClick={addService}
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                + Agregar Servicio
              </button>
            )}
            {tabs[activeTab].servicio.some((s) => s) && (
              <div className="mt-2">
                <span className="text-sm font-medium text-gray-700">
                  Nuevo Valor del Servicio: {formatCOP(calcularValores(tabs[activeTab].servicio).nuevoValorServicio)}
                </span>
              </div>
            )}
          </div>

          {/* Servicios Pendientes para este paciente */}
          {tabs[activeTab].docId && Object.keys(serviciosPendientes).length > 0 && (
            <div className="mt-4 bg-yellow-50 p-4 border border-yellow-300 rounded-lg">
              <div className="flex items-center justify-between">
                <label className="block text-lg font-medium text-yellow-800 mb-2">
                  ¡ATENCIÓN! Este paciente tiene servicios con pagos pendientes
                </label>
              </div>
              
              <div className="bg-white p-3 rounded-md border border-yellow-200 mb-4">
                {Object.entries(serviciosPendientes).map(([servicio, registros]) => (
                  <div key={servicio} className="flex items-center justify-between py-3 px-4 mb-2 border-b border-yellow-100 bg-yellow-50 rounded-md">
                    <div>
                      <p className="font-medium text-lg">{servicio}</p>
                      <p className="text-md text-red-600 font-semibold">Pendiente de pago: {formatCOP(registros[0]?.valor_liquidado || 0)}</p>
                      <p className="text-sm text-gray-600">Fecha de inicio: {registros[0]?.fecha}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => seleccionarServicioPendiente(servicio)}
                      className="px-4 py-2 bg-blue-600 text-white text-md rounded-lg hover:bg-blue-700 font-medium shadow-sm"
                    >
                      Completar Pago
                    </button>
                  </div>
                ))}
              </div>
              
              {seleccionadoServicioPendiente && (
                <div className="bg-green-50 p-4 rounded-md border-2 border-green-300 mb-4">
                  <p className="font-bold text-green-800 text-lg">
                    Completando pago para: {seleccionadoServicioPendiente.servicio}
                  </p>
                  <p className="text-md text-green-700 font-semibold my-2">
                    Valor a pagar: {formatCOP(seleccionadoServicioPendiente.valor_liquidado)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSeleccionadoServicioPendiente(null)}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Saldo a Favor</label>
            <span className="text-sm text-gray-600">{formatCOP(saldoAFavor)}</span>
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
                      {metodo === 'Datáfono' ? 'Datáfono (Tarjeta crédito / Tarjeta débito)' : 
                       metodo === 'Crédito' ? 'Crédito (DataCredito, SisteCredito, Addi)' : 
                       metodo}
                    </option>
                  ))}
                </select>

                {metodoPagoAbono && (
                  <>
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Abono (COP)</label>
                      <div className="flex items-center space-x-4">
                        <div className="relative w-full">
                          <input
                            type="text"
                            value={formatNumberInput(abonoInput)}
                            onChange={(e) => setAbonoInput(e.target.value.replace(/[^0-9]/g, ''))}
                            onWheel={handleWheel}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-8"
                            required
                          />
                          <span className="absolute inset-y-0 right-2 flex items-center text-gray-500">$</span>
                        </div>
                        {esDatáfonoAbono && (
                          <span className="text-sm text-gray-600">
                            Valor a cobrar en el datáfono: {formatCOP((parseNumberInput(abonoInput) * 1.05))}
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
                    {metodoPagoAbono === 'Crédito' && (
                      <>
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Monto Prestado (Abono) (COP)</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={formatNumberInput(montoPrestado)}
                              onChange={(e) => setMontoPrestado(e.target.value.replace(/[^0-9]/g, ''))}
                              onWheel={handleWheel}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-8"
                              required
                            />
                            <span className="absolute inset-y-0 right-2 flex items-center text-gray-500">$</span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Titular del Crédito (Abono)</label>
                          <input
                            type="text"
                            value={titularCredito}
                            onChange={(e) => setTitularCredito(e.target.value)}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            required
                          />
                        </div>
                      </>
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
                    <div className="relative w-full">
                      <input
                        type="text"
                        value={esPorcentaje ? descuentoInput : formatNumberInput(descuentoInput)}
                        onChange={(e) => setDescuentoInput(e.target.value.replace(/[^0-9.]/g, ''))}
                        onWheel={handleWheel}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-8"
                        required
                      />
                      {!esPorcentaje && (
                        <span className="absolute inset-y-0 right-2 flex items-center text-gray-500">$</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
            <select
              value={tabs[activeTab].metodoPago}
              onChange={(e) => updateTab(activeTab, (prev) => ({ ...prev, metodoPago: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">Selecciona un método de pago</option>
              {metodosPago.map((metodo) => (
                <option key={metodo} value={metodo}>
                  {metodo === 'Datáfono' ? 'Datáfono (Tarjeta crédito / Tarjeta débito)' : 
                   metodo === 'Crédito' ? 'Crédito (DataCredito, SisteCredito, Addi)' : 
                   metodo}
                </option>
              ))}
            </select>
            {tabs[activeTab].metodoPago && (
              <>
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Valor Pagado (COP)</label>
                  <div className="flex items-center space-x-4">
                    <div className="relative w-full">
                      <input
                        type="text"
                        value={formatNumberInput(valorPagado)}
                        onChange={(e) => setValorPagado(e.target.value.replace(/[^0-9]/g, ''))}
                        onWheel={handleWheel}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-8"
                        required
                      />
                      <span className="absolute inset-y-0 right-2 flex items-center text-gray-500">$</span>
                    </div>
                    {esDatáfono && (
                      <span className="text-sm text-gray-600">
                        Valor a cobrar en el datáfono: {formatCOP((parseNumberInput(valorPagado) * 1.05))}
                      </span>
                    )}
                  </div>
                </div>
                {tabs[activeTab].metodoPago === 'Transferencia' && (
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
                {tabs[activeTab].metodoPago === 'Crédito' && (
                  <>
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Monto Prestado (COP)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formatNumberInput(montoPrestado)}
                          onChange={(e) => setMontoPrestado(e.target.value.replace(/[^0-9]/g, ''))}
                          onWheel={handleWheel}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-8"
                          required
                        />
                        <span className="absolute inset-y-0 right-2 flex items-center text-gray-500">$</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Titular del Crédito</label>
                      <input
                        type="text"
                        value={titularCredito}
                        onChange={(e) => setTitularCredito(e.target.value)}
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
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Efectivo Actual</label>
            <div className="flex items-center space-x-2">
              <div className="relative w-full">
                <input
                  type="text"
                  value={formatNumberInput(baseInput)}
                  onChange={(e) => isAdminOrOwner && setBaseInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onWheel={handleWheel}
                  className={`w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-8 ${
                    !isAdminOrOwner ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  disabled={!isAdminOrOwner || loadingBase}
                  readOnly={!isAdminOrOwner}
                  placeholder={loadingBase ? 'Cargando...' : ''}
                />
                <span className="absolute inset-y-0 right-2 flex items-center text-gray-500">$</span>
              </div>
              {isAdminOrOwner && (
                <button
                  type="button"
                  onClick={handleUpdateBase}
                  className="bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-green-300"
                  disabled={loadingBase}
                >
                  {loadingBase ? '...' : 'Actualizar'}
                </button>
              )}
            </div>
            {errorBase && (
              <p className={`text-xs mt-1 ${errorBase.startsWith('Error') ? 'text-red-500' : 'text-green-600'}`}>
                {errorBase}
              </p>
            )}
            {!isAdminOrOwner && (
              <p className="text-xs text-gray-500 mt-1">Solo Admin puede modificar.</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Se actualiza automáticamente con pagos/abonos en efectivo.</p>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notas (Opcional)</label>
          <textarea
            value={tabs[activeTab].notas || ''}
            onChange={(e) => updateTab(activeTab, (prev) => ({ ...prev, notas: e.target.value }))}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            rows={4}
            placeholder="Ingresa cualquier novedad o comentario adicional..."
          />
        </div>

        <div className="mt-6">
          <button
            type="submit"
            className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-4 py-2 rounded-md hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Saldo a Favor Usado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Valor Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Valor Restante
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                  Método de Pago
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]">
                  Fecha Inicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                  Notas
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
                    {formatCOP(registro.saldoAFavorUsado ?? 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCOP(registro.valor_total ?? 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCOP(registro.valor_liquidado ?? 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {registro.metodoPago ? `${registro.metodoPago} (${formatCOP(registro.valor_pagado ?? 0)})` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {registro.fecha}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {registro.notas || 'N/A'}
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