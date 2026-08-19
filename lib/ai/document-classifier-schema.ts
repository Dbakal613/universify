import { z } from "zod";

export const documentClassifierSchema = z.object({
  filename: z.string(),

  documentType: z.enum([
    "syllabus",
    "cronograma",
    "horario",
    "calendario_academico",
    "exportacion_canvas",
    "exportacion_moodle",
    "guia_evaluacion",
    "presentacion",
    "libro",
    "apuntes",
    "otro",
  ]),

  confidence: z.number().min(0).max(1),

  detectedCourseName: z.string().nullable(),

  action: z.enum([
    "process",
    "ignore",
    "needs_review",
  ]),

  reason: z.string(),
});

export type ClassifiedDocument = z.infer<
  typeof documentClassifierSchema
>;