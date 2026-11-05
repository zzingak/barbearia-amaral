// Teste automático do sistema de reservas. Rode com: npm run test:booking
// Cria reservas de teste (e-mails @teste.local) e apaga tudo no final.
import { db } from "../src/lib/db";
import { addDays, getSlotsForProfessional, todayInSP, weekdayOf } from "../src/lib/availability";
import { BookingError, cancelBooking, createBooking, rescheduleBooking } from "../src/lib/booking";

let failures = 0;
function check(name: string, ok: boolean, extra = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failures++;
}
const codeOf = (e: unknown) => (e instanceof BookingError ? e.code : "OUTRO");

async function main() {
  const service = await db.service.findFirst({ where: { active: true }, orderBy: { id: "asc" } });
  const pro = await db.professional.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  if (!service || !pro) throw new Error("Rode antes: npm run db:seed");

  const base = { serviceId: service.id, professionalId: pro.id };
  const today = todayInSP();

  // Procura um dia com pelo menos 3 horários livres
  let date = "";
  let slots: string[] = [];
  for (let i = 1; i <= 14 && !date; i++) {
    const d = addDays(today, i);
    const s = await getSlotsForProfessional(db, { professionalId: pro.id, serviceId: service.id, date: d });
    if (s.length >= 3) {
      date = d;
      slots = s;
    }
  }
  if (!date) throw new Error("Nenhum dia com horários livres nos próximos 14 dias.");
  console.log(`\nUsando ${date} com o profissional "${pro.name}" e o serviço "${service.name}"\n`);

  // 1. Datas inválidas
  check("Data passada não tem horários", (await getSlotsForProfessional(db, { professionalId: pro.id, serviceId: service.id, date: addDays(today, -1) })).length === 0);
  const sunday = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1)).find((d) => weekdayOf(d) === 0);
  if (sunday) check("Dia sem funcionamento (domingo) não tem horários", (await getSlotsForProfessional(db, { professionalId: pro.id, serviceId: service.id, date: sunday })).length === 0);
  check("Data além do limite não tem horários", (await getSlotsForProfessional(db, { professionalId: pro.id, serviceId: service.id, date: addDays(today, 400) })).length === 0);

  // 2. Reserva normal
  const a = await createBooking({ ...base, date, time: slots[0], name: "Teste A", phone: "13999990001", email: "a@teste.local" });
  check("Criar reserva", a.status === "CONFIRMED" && a.priceCents === service.priceCents);

  // 3. Mesmo horário de novo
  let err = "";
  try {
    await createBooking({ ...base, date, time: slots[0], name: "Teste B", phone: "13999990002", email: "b@teste.local" });
  } catch (e) {
    err = codeOf(e);
  }
  check("Reservar horário já ocupado é recusado", err === "SLOT_TAKEN", `(${err})`);

  // 4. Cinco pessoas ao mesmo tempo no mesmo horário
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, (_, i) =>
      createBooking({ ...base, date, time: slots[2], name: `Teste C${i}`, phone: `1399999010${i}`, email: `c${i}@teste.local` }),
    ),
  );
  const okCount = results.filter((r) => r.status === "fulfilled").length;
  const reasons = results.map((r) => (r.status === "rejected" ? codeOf(r.reason) : "OK")).join(", ");
  check("5 tentativas simultâneas: só 1 consegue", okCount === 1, `(${reasons})`);

  // 5. Cancelar libera o horário
  await cancelBooking(a.code);
  const again = await createBooking({ ...base, date, time: slots[0], name: "Teste D", phone: "13999990003", email: "d@teste.local" });
  check("Cancelar libera o horário para outra pessoa", again.status === "CONFIRMED");

  // 6. Remarcar
  const moved = await rescheduleBooking(again.code, { date, time: slots[1] });
  check("Remarcar para um horário livre", moved.startsAt.getTime() !== again.startsAt.getTime());
  err = "";
  try {
    await rescheduleBooking(moved.code, { date, time: slots[2] });
  } catch (e) {
    err = codeOf(e);
  }
  check("Remarcar para horário ocupado é recusado", err === "SLOT_TAKEN", `(${err})`);

  console.log(failures ? `\n${failures} teste(s) FALHARAM.` : "\nTodos os testes passaram.");
}

async function cleanup() {
  const customers = await db.customer.findMany({ where: { email: { endsWith: "@teste.local" } }, select: { id: true } });
  const ids = customers.map((c) => c.id);
  const appts = await db.appointment.findMany({ where: { customerId: { in: ids } }, select: { id: true } });
  await db.notificationLog.deleteMany({ where: { appointmentId: { in: appts.map((a) => a.id) } } });
  await db.appointment.deleteMany({ where: { customerId: { in: ids } } });
  await db.customer.deleteMany({ where: { id: { in: ids } } });
}

main()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    await cleanup();
    await db.$disconnect();
    process.exit(failures ? 1 : 0);
  });
