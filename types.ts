// ...existing code...
export interface Round {
  id: string;
  location: string;
  status: RoundStatus;
  time: string;
  date?: string; // <-- Agrega esta línea
  completedTime?: string;
}
// ...existing code...
export enum RoundStatus {
  COMPLETED = 'Completado',
  PENDING = 'Pendiente',
  SCHEDULED = 'Programado'
}

export interface Round {
  id: string;
  location: string;
  status: RoundStatus;
  time: string;
  completedTime?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  date?: string;
  type: 'INCIDENCIA' | 'NOTIFICACION' | 'OBSERVACION';
  description: string;
  author: string;
}

export interface UserProfile {
  id_guardia: any;
  name: string;
  nombre?: string;
  apellido?: string;
  role: string;
  avatar: string;
  startTime: string;
  isActive: boolean;
  rut: string;
  correo: string;
  telefono: string;
}

export type TabType = 'RONDAS' | 'BITACORAS';
export type NavType = 'inicio' | 'mapa' | 'historial' | 'perfil' | 'notificaciones';
