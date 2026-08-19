export const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export function dateOnly(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function daysUntil(date: string, from = new Date()) {
  const [year, month, day] = date.split("-").map(Number);
  const start = Date.UTC(
    from.getFullYear(),
    from.getMonth(),
    from.getDate()
  );
  const target = Date.UTC(year, month - 1, day);

  return Math.round((target - start) / 86_400_000);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

export function mondayOfCurrentWeek() {
  const date = new Date();
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + delta);
  date.setHours(12, 0, 0, 0);

  return dateOnly(date);
}

export function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function countScheduledClasses(
  classes: { day: number }[],
  startDate: string,
  endDate: string
) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  let total = 0;
  const current = new Date(start);

  while (current <= end) {
    total += classes.filter((block) => block.day === current.getDay()).length;
    current.setDate(current.getDate() + 1);
  }

  return total;
}
