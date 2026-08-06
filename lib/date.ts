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
  return date.toISOString().slice(0, 10);
}

export function daysUntil(date: string, from = new Date()) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);

  const target = new Date(`${date}T12:00:00`);
  return Math.ceil((target.getTime() - start.getTime()) / 86_400_000);
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
