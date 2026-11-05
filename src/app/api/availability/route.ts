import { getAvailableDays, getSlots } from "@/lib/availability";
import { BookingError } from "@/lib/booking";
import { handle } from "@/lib/http";
import { availabilityQuery } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/availability?serviceId=1&month=2026-11        -> dias com horários livres
// GET /api/availability?serviceId=1&date=2026-11-10      -> horários livres do dia
// (opcional: &professionalId=2)
export async function GET(req: Request) {
  return handle(async () => {
    const q = availabilityQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
    if (q.date) return { date: q.date, slots: await getSlots(q.date, q.serviceId, q.professionalId) };
    if (q.month) return { month: q.month, days: await getAvailableDays(q.month, q.serviceId, q.professionalId) };
    throw new BookingError("INVALID", "Informe date ou month.");
  });
}
