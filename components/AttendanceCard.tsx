"use client";

import type { Course } from "../lib/types";
import { useProgress } from "./ProgressProvider";

export default function AttendanceCard({ course }: { course: Course }) {
  const { attendance, setAttendance } = useProgress();
  const record = attendance[course.id] ?? { attended: 0, total: 0 };
  const percentage = (record.attended / course.totalClasses) * 100;
  const todayBlock = course.classes.find(
    (block) => block.day === new Date().getDay()
  );

  return (
    <article className={`rounded-3xl p-5 ${course.color}`}>
      <h3 className="font-semibold">{course.name}</h3>

      {todayBlock && (
        <p className="mt-1 text-sm">
          {todayBlock.start}–{todayBlock.end}
          {todayBlock.room ? ` · ${todayBlock.room}` : ""}
        </p>
      )}

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/80">
        <div
          className="h-full rounded-full bg-slate-950 transition-all"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <p className="mt-2 text-sm">
        {record.attended}/{course.totalClasses} clases ·{" "}
        {percentage.toFixed(1)}%
      </p>

      {course.attendanceRequired && (
        <p className="mt-1 text-xs text-slate-600">
          Mínimo exigido: {course.attendanceRequired}%
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() =>
            setAttendance((previous) => ({
              ...previous,
              [course.id]: {
                attended: Math.min(
                  record.attended + 1,
                  course.totalClasses
                ),
                total: Math.min(record.total + 1, course.totalClasses),
              },
            }))
          }
          className="rounded-xl bg-black px-4 py-2 text-sm text-white"
        >
          Asistí
        </button>

        <button
          onClick={() =>
            setAttendance((previous) => ({
              ...previous,
              [course.id]: {
                attended: record.attended,
                total: Math.min(record.total + 1, course.totalClasses),
              },
            }))
          }
          className="rounded-xl border border-black/20 px-4 py-2 text-sm"
        >
          Falté
        </button>
      </div>
    </article>
  );
}
