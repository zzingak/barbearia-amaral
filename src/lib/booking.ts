// Criar, consultar, cancelar e remarcar reservas.
// REGRA DE OURO: dois clientes nunca ficam com o mesmo horário.
// Como garantimos: cada operação roda em uma transação "Serializable" (uma de cada vez,
// do ponto de vista do banco). Dentro dela, a disponibilidade é calculada de novo no
// servidor imediatamente antes de gravar. Se duas pessoas confirmarem ao mesmo tempo,
// o banco derruba uma delas, que tenta de novo e descobre que o horário já foi ocupado.
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { ACTIVE_STATUSES, getSlotsForProfessional, toDate } from "./availability";

export class BookingError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1 para evitar confusão
const newCode = () => Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join("");

async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 15_000,
      });
    } catch (e) {
      const retryable = e instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P1008"].includes(e.code);
      if (!retryable) throw e;
      if (attempt >= 5) throw new BookingError("BUSY", "Muitas reservas ao mesmo tempo. Tente novamente.", 503);
      await new Promise((r) => setTimeout(r, 50 * attempt + Math.random() * 100));
    }
  }
}

const include = { service: true, professional: true, customer: true } as const;

export type CreateBookingInput = {
  serviceId: number;
  professionalId?: number | null;
  date: string;
  time: string;
  name: string;
  phone: string;
  email: string;
};

export async function createBooking(input: CreateBookingInput) {
  return serializable(async (tx) => {
    const service = await tx.service.findUnique({ where: { id: input.serviceId } });
    if (!service || !service.active) throw new BookingError("SERVICE_UNAVAILABLE", "Serviço indisponível.");

    const candidates = input.professionalId
      ? [input.professionalId]
      : (await tx.professional.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } })).map((p) => p.id);

    let chosen: number | null = null;
    for (const professionalId of candidates) {
      const slots = await getSlotsForProfessional(tx, { professionalId, serviceId: service.id, date: input.date });
      if (slots.includes(input.time)) {
        chosen = professionalId;
        break;
      }
    }
    if (chosen === null) {
      throw new BookingError(
        "SLOT_TAKEN",
        "Esse horário acabou de ser reservado ou não está mais disponível. Escolha outro.",
        409,
      );
    }

    const startsAt = toDate(input.date, input.time);
    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60000);

    const existing = await tx.customer.findFirst({ where: { phone: input.phone, email: input.email } });
    const customer = existing
      ? await tx.customer.update({ where: { id: existing.id }, data: { name: input.name } })
      : await tx.customer.create({ data: { name: input.name, phone: input.phone, email: input.email } });

    const appointment = await tx.appointment.create({
      data: {
        code: newCode(),
        professionalId: chosen,
        serviceId: service.id,
        customerId: customer.id,
        startsAt,
        endsAt,
        status: "CONFIRMED",
        priceCents: service.priceCents, // sempre o preço do banco, nunca o do navegador
      },
      include,
    });

    await tx.notificationLog.create({
      data: {
        appointmentId: appointment.id,
        channel: "WHATSAPP",
        kind: "CONFIRMATION",
        status: "NOT_CONFIGURED",
        detail: "Integração com WhatsApp ainda não configurada. Nenhuma mensagem foi enviada.",
      },
    });

    return appointment;
  });
}

export async function getBooking(code: string) {
  const appointment = await db.appointment.findUnique({ where: { code }, include });
  if (!appointment) throw new BookingError("NOT_FOUND", "Agendamento não encontrado.", 404);
  return appointment;
}

export async function cancelBooking(code: string) {
  return serializable(async (tx) => {
    const appt = await tx.appointment.findUnique({ where: { code } });
    if (!appt) throw new BookingError("NOT_FOUND", "Agendamento não encontrado.", 404);
    if (!ACTIVE_STATUSES.includes(appt.status)) {
      throw new BookingError("NOT_CANCELLABLE", "Este agendamento não pode mais ser cancelado.", 409);
    }
    if (appt.startsAt.getTime() < Date.now()) {
      throw new BookingError("NOT_CANCELLABLE", "Este horário já passou.", 409);
    }
    const updated = await tx.appointment.update({ where: { id: appt.id }, data: { status: "CANCELLED" }, include });
    await tx.notificationLog.create({
      data: {
        appointmentId: appt.id,
        channel: "WHATSAPP",
        kind: "CANCELLATION",
        status: "NOT_CONFIGURED",
        detail: "Integração com WhatsApp ainda não configurada. Nenhuma mensagem foi enviada.",
      },
    });
    return updated;
  });
}

export async function rescheduleBooking(
  code: string,
  to: { date: string; time: string; professionalId?: number | null },
) {
  return serializable(async (tx) => {
    const appt = await tx.appointment.findUnique({ where: { code }, include: { service: true } });
    if (!appt) throw new BookingError("NOT_FOUND", "Agendamento não encontrado.", 404);
    if (!ACTIVE_STATUSES.includes(appt.status) || appt.startsAt.getTime() < Date.now()) {
      throw new BookingError("NOT_RESCHEDULABLE", "Este agendamento não pode mais ser alterado.", 409);
    }

    const professionalId = to.professionalId ?? appt.professionalId;
    const slots = await getSlotsForProfessional(tx, {
      professionalId,
      serviceId: appt.serviceId,
      date: to.date,
      excludeAppointmentId: appt.id,
    });
    if (!slots.includes(to.time)) {
      throw new BookingError("SLOT_TAKEN", "Esse horário não está disponível. Escolha outro.", 409);
    }

    const startsAt = toDate(to.date, to.time);
    const endsAt = new Date(startsAt.getTime() + appt.service.durationMin * 60000);
    const updated = await tx.appointment.update({
      where: { id: appt.id },
      data: { startsAt, endsAt, professionalId },
      include,
    });
    await tx.notificationLog.create({
      data: {
        appointmentId: appt.id,
        channel: "WHATSAPP",
        kind: "RESCHEDULE",
        status: "NOT_CONFIGURED",
        detail: "Integração com WhatsApp ainda não configurada. Nenhuma mensagem foi enviada.",
      },
    });
    return updated;
  });
}

/** Dados que podem ser mostrados ao cliente (sem telefone/e-mail de ninguém). */
export function toPublic(a: Awaited<ReturnType<typeof getBooking>>) {
  return {
    code: a.code,
    status: a.status,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    priceCents: a.priceCents,
    service: { id: a.service.id, name: a.service.name, durationMin: a.service.durationMin },
    professional: { id: a.professional.id, name: a.professional.name },
    customerName: a.customer.name,
  };
}
