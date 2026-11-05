import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");
const phone = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .refine((s) => s.length >= 10 && s.length <= 13, "Telefone inválido. Use DDD + número.");

export const bookingSchema = z.object({
  serviceId: z.number().int().positive(),
  professionalId: z.number().int().positive().nullish(),
  date,
  time,
  name: z.string().trim().min(2, "Informe seu nome.").max(80, "Nome muito longo."),
  phone,
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(120),
  consent: z.literal(true, { errorMap: () => ({ message: "É necessário aceitar a política de privacidade." }) }),
});

export const rescheduleSchema = z.object({
  date,
  time,
  professionalId: z.number().int().positive().nullish(),
});

export const availabilityQuery = z.object({
  serviceId: z.coerce.number().int().positive(),
  professionalId: z.coerce.number().int().positive().optional(),
  date: date.optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido.").optional(),
});

export const bookingCode = z.string().transform((s) => s.toUpperCase()).pipe(z.string().regex(/^[A-Z2-9]{8}$/, "Código inválido."));
