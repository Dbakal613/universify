export type EvaluationKind =
  | "control"
  | "prueba"
  | "entrega"
  | "presentacion"
  | "examen"
  | "actividad";

export type Evaluation = {
  name: string;
  date: string;
  time?: string;
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

export type ClassSession = {
  date: string;
  start?: string;
  end?: string;
  room?: string;
  topics?: string;
  status: "scheduled" | "cancelled";
  note?: string;
};

export type AutonomousTask = {
  weekStart: string;
  title: string;
  classTopics?: string;
  minutes?: number;
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
  classSessions: ClassSession[];
  evaluations: Evaluation[];
  gradeComponents: GradeComponent[];
  autonomousTasks: AutonomousTask[];
};

export type SemesterSettings = {
  name: string;
  year: number;
  term: string;
  startDate: string;
  endDate: string;
  timezone: string;
  locationName: string;
};

export type AttendanceRecord = {
  attended: number;
  total: number;
  sessions?: AttendanceSession[];
};

export type AttendanceSession = {
  date: string;
  start?: string;
  status: "attended" | "absent" | "justified";
};

export type ProgressState = {
  attendance: Record<string, AttendanceRecord>;
  grades: Record<string, Record<string, string>>;
  customActivities: Record<string, string[]>;
  targets: Record<string, number>;
};
