export type EvaluationKind =
  | "control"
  | "prueba"
  | "entrega"
  | "examen"
  | "actividad";

export type Evaluation = {
  name: string;
  date: string;
  kind: EvaluationKind;
  detail?: string;
};

export type GradeComponent = {
  name: string;
  weight: number;
  expandable?: "economia-controls" | "estadistica-pruebas" | "estadistica-controles" | "activities";
};

export type ClassBlock = {
  day: number;
  start: string;
  end: string;
  room?: string;
};

export type AutonomousTask = {
  weekStart: string;
  title: string;
  minutes: number;
  evaluation?: string;
};

export type Course = {
  id: string;
  name: string;
  professor: string;
  email: string;
  autonomousHours: number;
  totalClasses: number;
  attendanceRequired?: number;
  attendanceNote?: string;
  color: string;
  classes: ClassBlock[];
  evaluations: Evaluation[];
  gradeComponents: GradeComponent[];
  autonomousTasks: AutonomousTask[];
};

export type AttendanceRecord = {
  attended: number;
  total: number;
};

export type ProgressState = {
  attendance: Record<string, AttendanceRecord>;
  grades: Record<string, Record<string, string>>;
  customActivities: Record<string, string[]>;
  targets: Record<string, number>;
};
