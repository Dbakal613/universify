import PageShell from "../../components/PageShell";
import { courses } from "../../lib/data";
import { DAY_NAMES, toMinutes } from "../../lib/date";

const START = 8 * 60 + 30;
const END = 17 * 60 + 50;
const HEIGHT = 720;
const DAYS = [1, 2, 3, 4, 5, 6];

function top(time: string) {
  return ((toMinutes(time) - START) / (END - START)) * HEIGHT;
}

function blockHeight(start: string, end: string) {
  return Math.max(
    28,
    ((toMinutes(end) - toMinutes(start)) / (END - START)) * HEIGHT
  );
}

export default function SchedulePage() {
  const hours = [
    "08:30",
    "09:30",
    "10:30",
    "11:30",
    "12:30",
    "13:30",
    "14:30",
    "15:30",
    "16:30",
    "17:30",
  ];

  return (
    <PageShell
      title="Horario semanal"
      description="Las clases están alineadas por hora y ocupan visualmente toda su duración."
    >
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[70px_repeat(6,minmax(140px,1fr))] gap-3">
            <div />

            {DAYS.map((day) => (
              <div key={day} className="px-2 font-semibold">
                {DAY_NAMES[day]}
              </div>
            ))}

            <div className="relative" style={{ height: HEIGHT }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-2 text-xs text-slate-400"
                  style={{ top: top(hour) - 7 }}
                >
                  {hour}
                </div>
              ))}
            </div>

            {DAYS.map((day) => (
              <div
                key={day}
                className="relative rounded-2xl bg-white shadow-sm"
                style={{ height: HEIGHT }}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-slate-200/70"
                    style={{ top: top(hour) }}
                  />
                ))}

                {courses.flatMap((course) =>
                  course.classes
                    .filter((block) => block.day === day)
                    .map((block, index) => (
                      <div
                        key={`${course.id}-${index}`}
                        className={`absolute left-2 right-2 overflow-hidden rounded-xl p-2 shadow-sm ${course.color}`}
                        style={{
                          top: top(block.start),
                          height: blockHeight(block.start, block.end),
                        }}
                      >
                        <p className="text-xs font-semibold">
                          {block.start}–{block.end}
                        </p>
                        <p className="mt-1 text-xs">{course.name}</p>

                        {block.room && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            {block.room}
                          </p>
                        )}
                      </div>
                    ))
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
