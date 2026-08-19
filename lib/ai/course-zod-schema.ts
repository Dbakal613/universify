import { z } from "zod";

export const extractedCourseSchema = z.object({
  name: z.string(),
  code: z.string().nullable(),
  totalHours: z.number().nullable(),
  autonomousHours: z.number().nullable(),

  professor: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
  }),

  classes: z.array(
    z.object({
      day: z.number().int().min(1).max(7),
      start: z.string(),
      end: z.string(),
      room: z.string().nullable(),
    })
  ),

  classSessions: z.array(
    z.object({
      date: z.string(),
      start: z.string().nullable(),
      end: z.string().nullable(),
      room: z.string().nullable(),
      topics: z.string().nullable(),
      status: z.enum(["scheduled", "cancelled"]),
      note: z.string().nullable(),
    })
  ),

  attendance: z.object({
    requiredPercentage: z.number().nullable(),
    totalClasses: z.number().int().nullable(),
    gradingWeight: z.number().nullable(),
    rules: z.string().nullable(),
  }),

  evaluations: z.array(
    z.object({
      name: z.string(),
      date: z.string().nullable(),
      time: z.string().nullable(),
      type: z.enum([
        "control",
        "prueba",
        "entrega",
        "presentacion",
        "examen",
        "actividad",
      ]),
      weight: z.number().nullable(),
      topics: z.string().nullable(),
    })
  ),

  gradeComponents: z.array(
    z.object({
      name: z.string(),
      weight: z.number().nullable(),
    })
  ),

  autonomousWork: z.array(
    z.object({
      weekStart: z.string().nullable(),
      title: z.string(),
      classTopics: z.string().nullable(),
      estimatedMinutes: z.number().int().nullable(),
      relatedEvaluation: z.string().nullable(),
    })
  ),

  missingInformation: z.array(z.string()),
});

export const extractedCoursesSchema = z.object({
  courses: z.array(extractedCourseSchema),
});

export type ExtractedCourseInput = z.infer<
  typeof extractedCourseSchema
>;

export type ExtractedCoursesInput = z.infer<
  typeof extractedCoursesSchema
>;
