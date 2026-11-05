// Cálculo de horários disponíveis.
// O Brasil não usa mais horário de verão, então o fuso de São Paulo é sempre UTC-03:00.
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

export type Tx = PrismaClient | Prisma.TransactionClient;

const SP_OFFSET = "-03:00";
const SP_OFFSET_MS = 3 * 3600_000;
export const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"];

type Interval = [number, number]; // minutos desde 00:00 do dia

export const toDate = (date: string, time: string) => new Date(`${date}T${time}:00${SP_OFFSET}`);

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const toHHmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Data de hoje em São Paulo, no formato AAAA-MM-DD */
export function todayInSP(now = new Date()): string {
  return new Date(now.getTime() - SP_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00${SP_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Date(d.getTime() - SP_OFFSET_MS).toISOString().slice(0, 10);
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T12:00:00${SP_OFFSET}`);
  return !isNaN(d.getTime()) && addDays(date, 0) === date;
}

/** 0 = domingo ... 6 = sábado */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00${SP_OFFSET}`).getUTCDay();
}

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/**
 * Horários livres (ex.: ["09:00","09:30"]) de UM profissional em uma data.
 * Aplica todas as regras: dias de funcionamento, intervalos, folgas/feriados,
 * bloqueios, reservas existentes, duração do serviço, tempo entre clientes,
 * antecedência mínima e limite de dias futuros.
 * `excludeAppointmentId` serve para o reagendamento (ignora a própria reserva).
 */
export async function getSlotsForProfessional(
  tx: Tx,
  o: { professionalId: number; serviceId: number; date: string; excludeAppointmentId?: number; now?: Date },
): Promise<string[]> {
  if (!isValidDate(o.date)) return [];
  const now = o.now ?? new Date();

  const [settings, service, pro] = await Promise.all([
    tx.setting.findUnique({ where: { id: 1 } }),
    tx.service.findUnique({ where: { id: o.serviceId } }),
    tx.professional.findUnique({ where: { id: o.professionalId } }),
  ]);
  if (!settings || !service || !service.active || !pro || !pro.active) return [];

  const today = todayInSP(now);
  if (o.date < today || o.date > addDays(today, settings.maxDaysAhead)) return [];

  const weekday = weekdayOf(o.date);
  const hour = await tx.businessHour.findUnique({
    where: { professionalId_weekday: { professionalId: o.professionalId, weekday } },
  });
  if (!hour) return [];

  const blocks = await tx.blockedDate.findMany({
    where: { date: o.date, OR: [{ professionalId: null }, { professionalId: o.professionalId }] },
  });
  if (blocks.some((b) => !b.startTime || !b.endTime)) return []; // dia inteiro bloqueado

  const breaks = await tx.breakTime.findMany({ where: { professionalId: o.professionalId, weekday } });

  const dayStart = toDate(o.date, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const appts = await tx.appointment.findMany({
    where: {
      professionalId: o.professionalId,
      status: { in: ACTIVE_STATUSES },
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
      ...(o.excludeAppointmentId ? { id: { not: o.excludeAppointmentId } } : {}),
    },
  });

  const fixedBusy: Interval[] = [
    ...breaks.map((b) => [toMin(b.startTime), toMin(b.endTime)] as Interval),
    ...blocks.map((b) => [toMin(b.startTime!), toMin(b.endTime!)] as Interval),
  ];
  const apptBusy: Interval[] = appts.map(
    (a) =>
      [
        (a.startsAt.getTime() - dayStart.getTime()) / 60000,
        (a.endsAt.getTime() - dayStart.getTime()) / 60000,
      ] as Interval,
  );

  const buffer = settings.bufferMinutes;
  const earliest = now.getTime() + settings.minNoticeMinutes * 60000;
  const close = toMin(hour.closeTime);
  const slots: string[] = [];

  for (let m = toMin(hour.openTime); m + service.durationMin <= close; m += settings.slotStepMinutes) {
    const end = m + service.durationMin;
    if (toDate(o.date, toHHmm(m)).getTime() < earliest) continue;
    if (fixedBusy.some(([s, e]) => overlaps(m, end, s, e))) continue;
    if (apptBusy.some(([s, e]) => overlaps(m - buffer, end + buffer, s, e))) continue;
    slots.push(toHHmm(m));
  }
  return slots;
}

/** Horários livres de uma data considerando todos os profissionais (ou só um). */
export async function getSlots(date: string, serviceId: number, professionalId?: number) {
  const pros = await db.professional.findMany({
    where: { active: true, ...(professionalId ? { id: professionalId } : {}) },
    orderBy: { sortOrder: "asc" },
  });
  const byTime = new Map<string, number[]>();
  for (const p of pros) {
    const slots = await getSlotsForProfessional(db, { professionalId: p.id, serviceId, date });
    for (const t of slots) byTime.set(t, [...(byTime.get(t) ?? []), p.id]);
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, professionalIds]) => ({ time, professionalIds }));
}

/** Dias de um mês ("2026-11") que têm pelo menos um horário livre. Alimenta o calendário. */
export async function getAvailableDays(month: string, serviceId: number, professionalId?: number) {
  const [y, m] = month.split("-").map(Number);
  if (!y || m < 1 || m > 12) return [];
  const settings = await db.setting.findUnique({ where: { id: 1 } });
  if (!settings) return [];
  const today = todayInSP();
  const last = addDays(today, settings.maxDaysAhead);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const days: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    if (date < today || date > last) continue;
    if ((await getSlots(date, serviceId, professionalId)).length > 0) days.push(date);
  }
  return days;
}
