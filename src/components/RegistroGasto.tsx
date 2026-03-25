import React, { useState, useEffect } from "react";
import axios from "axios";

interface Gasto {
  fecha: string;
  concepto: string;
  proveedor: string;
  tipoGasto: string;
  valor: number;
  responsable: string;
  comentario?: string;
}

interface GastoPayload extends Gasto {
  id_sede: number;
}

interface ConceptoData {
  concepto: string;
  proveedor: string;
  tipo: string;
}

const conceptosIniciales = [
  { concepto: "Insumos", proveedor: "", tipo: "" },
  { concepto: "Domicilios", proveedor: "", tipo: "" },
  { concepto: "Otro", proveedor: "", tipo: "" },
];

const RegistroGasto: React.FC = () => {
  const [gasto, setGasto] = useState<Gasto>({
    fecha: new Date().toISOString().split("T")[0],
    concepto: "",
    proveedor: "",
    tipoGasto: "",
    valor: 0,
    responsable: "",
    comentario: "",
  });
  const [conceptos, setConceptos] = useState<ConceptoData[]>(conceptosIniciales);
  const [showModal, setShowModal] = useState(false);
  const [nuevoConcepto, setNuevoConcepto] = useState<ConceptoData>({ concepto: "", proveedor: "", tipo: "" });
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null);
  const [conceptoPersonalizado, setConceptoPersonalizado] = useState<string>("");
  const [responsables, setResponsables] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [isCustomConcept, setIsCustomConcept] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const checkAdminStatus = () => {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      setIsAdmin(user && ['Dueño', 'Admin'].includes(user.usuario));
    };

    checkAdminStatus();
  }, []);

  useEffect(() => {
    const fetchResponsables = async () => {
      try {
        const id_sede = localStorage.getItem("selectedSede");
        if (!id_sede) {
          setError("No se ha seleccionado una sede. Por favor, selecciónala.");
          return;
        }

        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const isEstadio = id_sede === "2";

        const assistantsResponse = await axios.get(`${import.meta.env.VITE_API_URL}/api/assistants`, {
          headers,
          params: { id_sede },
        });

        let responsablesList: string[] = [...(assistantsResponse.data as string[])];

        if (isEstadio) {
          const fijos = ["Liliana Gutiérrez", "Miriam"];
          responsablesList = [...new Set([...responsablesList, ...fijos])].sort();
        } else {
          const doctorsResponse = await axios.get(`${import.meta.env.VITE_API_URL}/api/doctors`, {
            headers,
            params: { id_sede },
          });
          responsablesList = [
            ...new Set([
              ...(doctorsResponse.data as string[]),
              ...responsablesList,
            ]),
          ].sort();
        }

        setResponsables(responsablesList);
      } catch (err: any) {
        console.error("Error al cargar responsables:", err);
        setError("No se pudo cargar la lista de responsables.");
      }
    };

    fetchResponsables();
  }, []);

  const handleConceptoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const conceptoSeleccionado = conceptos.find((c) => c.concepto === e.target.value);
    const isOtherSelected = e.target.value === "Otro";

    setIsCustomConcept(isOtherSelected);
    setGasto({
      ...gasto,
      concepto: e.target.value,
      proveedor: isOtherSelected ? "" : (conceptoSeleccionado?.proveedor || ""),
      tipoGasto: isOtherSelected ? "" : (conceptoSeleccionado?.tipo || ""),
    });
    setConceptoPersonalizado("");
  };

  const handleNuevoConceptoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNuevoConcepto(prev => ({ ...prev, [name]: value }));
  };

  const handleGuardarConcepto = () => {
    if (!nuevoConcepto.concepto) {
      setError("El nombre del concepto es obligatorio");
      return;
    }

    if (editandoIndex !== null) {
      // Editar concepto existente
      const nuevosConceptos = [...conceptos];
      nuevosConceptos[editandoIndex] = nuevoConcepto;
      setConceptos(nuevosConceptos);
    } else {
      // Agregar nuevo concepto
      setConceptos(prev => [...prev, nuevoConcepto]);
    }

    setNuevoConcepto({ concepto: "", proveedor: "", tipo: "" });
    setEditandoIndex(null);
    setShowModal(false);
  };

  const handleEditarConcepto = (index: number) => {
    setNuevoConcepto(conceptos[index]);
    setEditandoIndex(index);
    setShowModal(true);
  };

  const handleEliminarConcepto = (index: number) => {
    if (conceptos[index].concepto === "Otro") {
      setError("No se puede eliminar el concepto 'Otro'");
      return;
    }
    const nuevosConceptos = conceptos.filter((_, i) => i !== index);
    setConceptos(nuevosConceptos);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "conceptoPersonalizado") {
      setConceptoPersonalizado(value);
    } else {
      setGasto({
        ...gasto,
        [name]: name === "valor" ? parseFloat(value) || 0 : value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    const id_sede_str = localStorage.getItem("selectedSede");
    if (!id_sede_str) {
      setError("No se ha seleccionado una sede. Por favor, selecciónala.");
      setLoading(false);
      return;
    }

    const id_sede = parseInt(id_sede_str, 10);

    if (
      !gasto.fecha ||
      (!gasto.concepto && !conceptoPersonalizado) ||
      !gasto.proveedor ||
      !gasto.tipoGasto ||
      !gasto.valor ||
      gasto.valor <= 0 ||
      !gasto.responsable
    ) {
      setError("Por favor, completa todos los campos obligatorios y asegúrate que el valor sea positivo.");
      setLoading(false);
      return;
    }

    const formattedDate = gasto.fecha;

    const payload: GastoPayload = {
      ...gasto,
      fecha: formattedDate,
      concepto: gasto.concepto === "Otro" ? conceptoPersonalizado : gasto.concepto,
      id_sede,
    };

    console.log("Enviando Gasto:", payload);

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/gastos`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccessMessage("¡Gasto registrado exitosamente!");
      setGasto({
        fecha: new Date().toISOString().split("T")[0],
        concepto: "",
        proveedor: "",
        tipoGasto: "",
        valor: 0,
        responsable: "",
        comentario: "",
      });
      setIsCustomConcept(false);
      setConceptoPersonalizado("");
    } catch (err: any) {
      console.error("Error registrando gasto:", err);
      setError(err.response?.data?.error || err.message || "Error al registrar el gasto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="flex flex-col mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Registrar Gasto Diario
          </h2>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center px-3 py-1.5 bg-white border border-teal-500 text-teal-600 rounded-md hover:bg-teal-50 transition-colors duration-200 text-sm"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Gestionar Conceptos
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Clínica Smiley - Control de Gastos
        </p>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-800">
                {editandoIndex !== null ? "Editar Concepto" : "Nuevo Concepto"}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setNuevoConcepto({ concepto: "", proveedor: "", tipo: "" });
                  setEditandoIndex(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Concepto
                </label>
                <input
                  type="text"
                  name="concepto"
                  value={nuevoConcepto.concepto}
                  onChange={handleNuevoConceptoChange}
                  placeholder="Ej: Materiales de Oficina"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor por Defecto
                </label>
                <input
                  type="text"
                  name="proveedor"
                  value={nuevoConcepto.proveedor}
                  onChange={handleNuevoConceptoChange}
                  placeholder="Opcional"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo por Defecto
                </label>
                <input
                  type="text"
                  name="tipo"
                  value={nuevoConcepto.tipo}
                  onChange={handleNuevoConceptoChange}
                  placeholder="Opcional"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setNuevoConcepto({ concepto: "", proveedor: "", tipo: "" });
                    setEditandoIndex(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarConcepto}
                  className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors duration-200"
                >
                  {editandoIndex !== null ? "Guardar Cambios" : "Agregar Concepto"}
                </button>
              </div>

              {editandoIndex === null && (
                <div className="mt-6 border-t pt-6">
                  <h4 className="font-medium text-gray-800 mb-3">Conceptos Existentes</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {conceptos.map((concepto, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md"
                      >
                        <span className="text-gray-700">{concepto.concepto}</span>
                        <div className="space-x-2">
                          <button
                            onClick={() => handleEditarConcepto(index)}
                            className="text-teal-600 hover:text-teal-800 text-sm"
                          >
                            Editar
                          </button>
                          {concepto.concepto !== "Otro" && (
                            <button
                              onClick={() => handleEliminarConcepto(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
            {successMessage}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600">Fecha</label>
          <input
            type="date"
            name="fecha"
            value={gasto.fecha}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm p-1.5"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600">Concepto</label>
          <select
            name="concepto"
            value={gasto.concepto}
            onChange={handleConceptoChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm p-1.5"
            required
          >
            <option value="">Seleccione un concepto</option>
            {conceptos.map((c) => (
              <option key={c.concepto} value={c.concepto}>
                {c.concepto}
              </option>
            ))}
          </select>
        </div>

        {isCustomConcept && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600">Concepto Personalizado</label>
            <input
              type="text"
              name="conceptoPersonalizado"
              value={conceptoPersonalizado}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm p-1.5"
              placeholder="Ingrese el concepto personalizado"
              required
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600">Proveedor</label>
          <input
            type="text"
            name="proveedor"
            value={gasto.proveedor}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm p-1.5"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600">Tipo de Gasto</label>
          <input
            type="text"
            name="tipoGasto"
            value={gasto.tipoGasto}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm p-1.5"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600">Valor ($)</label>
          <input
            type="number"
            name="valor"
            value={gasto.valor}
            onChange={handleChange}
            min="0"
            step="any"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-sm p-1.5"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600">Responsable</label>
          <select
            name="responsable"
            value={gasto.responsable}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm p-1.5"
            required
          >
            <option value="">Seleccione un responsable</option>
            {responsables.map((responsable) => (
              <option key={responsable} value={responsable}>
                {responsable}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600">Comentario (opcional)</label>
          <textarea
            name="comentario"
            value={gasto.comentario || ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 text-sm p-1.5"
            rows={3}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full flex justify-center items-center px-3 py-1.5 rounded-md text-white font-medium bg-gradient-to-r from-teal-600 to-teal-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-transform duration-200 text-sm ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          {loading ? "Registrando..." : "Registrar Gasto"}
        </button>
      </form>
    </div>
  );
};

export default RegistroGasto;