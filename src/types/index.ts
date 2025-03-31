// src/types/index.ts
export interface DentalRecord {
  sede: string;
  id: string;
  nombreDoctor: string; // nombre_doc
  nombrePaciente: string; // paciente
  docId: string; // doc_id (documento del paciente)
  servicio: string; // nombre_serv
  abono: number | null; // abono (puede ser null si no hay abono)
  descuento: number | null; // dcto (puede ser null si no hay descuento)
  total: number; // valor_total
  fecha: string; // fecha_inicio
  metodoPago: string; // metodo_pago
  idPorc: number; // id_porc (obligatorio, se asignará según el porcentaje)
  fechaFinal?: string; // fecha_final (opcional, no se usará en el formulario)
}


export interface Sede {
  id_sede: number;
  sede: string;
}

export interface Doctor {
  id_doc: number;
  nombre_doc: string;
}

export interface Servicio {
  nombre: string;
  valor: number;
  sede: string;
}

export interface Liquidacion {
  id: number;
  doctor: string;
  fecha_inicio: string; 
  fecha_fin: string; 
  servicios: Servicio[];
  total_liquidado: number; 
  fecha_liquidacion: string; 
}