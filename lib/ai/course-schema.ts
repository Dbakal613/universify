export type ExtractedCourse = {
  name: string;
  code: string | null;
  totalHours: number | null;
  autonomousHours: number | null;

  professor: {
    name: string | null;
    email: string | null;
  };

  classes: {
    day: number;
    start: string;
    end: string;
    room: string | null;
  }[];

  classSessions: {
    date: string;
    start: string | null;
    end: string | null;
    room: string | null;
    topics: string | null;
    status: "scheduled" | "cancelled";
    note: string | null;
  }[];

  attendance: {
    requiredPercentage: number | null;
    totalClasses: number | null;
    gradingWeight: number | null;
    rules: string | null;
  };

  evaluations: {
    name: string;
    date: string | null;
    time: string | null;
    type:
      | "control"
      | "prueba"
      | "entrega"
      | "presentacion"
      | "examen"
      | "actividad";
    weight: number | null;
    topics: string | null;
  }[];

  gradeComponents: {
    name: string;
    weight: number | null;
  }[];

  autonomousWork: {
    weekStart: string | null;
    title: string;
    classTopics: string | null;
    estimatedMinutes: number | null;
    relatedEvaluation: string | null;
  }[];

  missingInformation: string[];
};
