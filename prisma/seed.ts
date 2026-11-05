// Cria dados iniciais. Tudo marcado com "(DEMO)" é de demonstração:
// edite ou apague pelo painel administrativo depois.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no arquivo .env");
  }

  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 12) },
    create: { email, passwordHash: await bcrypt.hash(password, 12) },
  });

  await prisma.establishment.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Barbearia (DEMO)",
      tagline: "Corte e barba com hora marcada",
      description: "Texto de demonstração. Edite pelo painel administrativo.",
      address: "Endereço de demonstração, Guarujá - SP",
      phone: "(13) 00000-0000",
      whatsapp: "5513000000000",
    },
  });

  await prisma.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  if ((await prisma.professional.count()) === 0) {
    const pros = [];
    for (const [i, name] of ["Barbeiro 1 (DEMO)", "Barbeiro 2 (DEMO)"].entries()) {
      pros.push(await prisma.professional.create({ data: { name, sortOrder: i } }));
    }
    // Terça (2) a sábado (6), 09:00 às 19:00, almoço 12:00 às 13:00
    for (const p of pros) {
      for (const weekday of [2, 3, 4, 5, 6]) {
        await prisma.businessHour.create({
          data: { professionalId: p.id, weekday, openTime: "09:00", closeTime: "19:00" },
        });
        await prisma.breakTime.create({
          data: { professionalId: p.id, weekday, startTime: "12:00", endTime: "13:00" },
        });
      }
    }
  }

  if ((await prisma.service.count()) === 0) {
    await prisma.service.createMany({
      data: [
        { name: "Corte de cabelo (DEMO)", description: "Serviço de demonstração.", priceCents: 4500, durationMin: 30, sortOrder: 0 },
        { name: "Barba (DEMO)", description: "Serviço de demonstração.", priceCents: 3000, durationMin: 30, sortOrder: 1 },
        { name: "Corte + Barba (DEMO)", description: "Serviço de demonstração.", priceCents: 7000, durationMin: 60, sortOrder: 2 },
      ],
    });
  }

  console.log("Dados iniciais criados com sucesso.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
