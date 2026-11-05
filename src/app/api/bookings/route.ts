import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const barberId = searchParams.get("barberId") || searchParams.get("professionalId");

    const whereClause: any = {};
    if (barberId) {
      whereClause.professionalId = Number(barberId);
    }

    const bookings = await db.booking.findMany({
      where: whereClause,
      include: {
        customer: true,
        service: true,
        professional: true,
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Erro ao buscar agendamentos:", error);
    return NextResponse.json({ error: "Erro interno ao buscar agendamentos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { serviceId, barberId, date, name, phone } = await request.json();

    if (!serviceId || !barberId || !date || !name) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
    }

    const professionalId = Number(barberId);
    const startDate = new Date(date);

    // Se for Nevou ou Luzes, ocupa 2 blocos de horário (120 min), senão 60 min
    const isLongService = serviceId === "nevou" || serviceId === "luzes";
    const durationMinutes = isLongService ? 120 : 60;

    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

    const conflictingBooking = await db.booking.findFirst({
      where: {
        professionalId,
        OR: [
          {
            startsAt: { lt: endDate },
            endsAt: { gt: startDate },
          },
        ],
      },
    });

    if (conflictingBooking) {
      return NextResponse.json(
        { error: "Este horário e o intervalo necessário já estão ocupados para este barbeiro." },
        { status: 400 }
      );
    }

    let dbService = await db.service.findFirst({
      where: { id: serviceId },
    });

    if (!dbService) {
      const priceMap: Record<string, number> = {
        corte: 4000,
        barba: 2500,
        combo: 6000,
        nevou: 14000,
        luzes: 12000,
        corte_pente: 3000,
      };
      const nameMap: Record<string, string> = {
        corte: "Cabelo",
        barba: "Barba",
        combo: "Cabelo e Barba",
        nevou: "Nevou",
        luzes: "Luzes",
        corte_pente: "Corte 1 Pente",
      };

      dbService = await db.service.create({
        data: {
          id: serviceId,
          name: nameMap[serviceId] || "Procedimento",
          priceCents: priceMap[serviceId] || 4000,
          durationMinutes,
        },
      });
    }

    const cleanPhone = phone ? String(phone).replace(/\D/g, "") : "";
    let customer = await db.customer.findFirst({
      where: { phone: cleanPhone },
    });

    if (!customer) {
      customer = await db.customer.create({
        data: { name: name.trim(), phone: cleanPhone },
      });
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const booking = await db.booking.create({
      data: {
        code,
        serviceId: dbService.id,
        professionalId,
        customerId: customer.id,
        startsAt: startDate,
        endsAt: endDate,
        status: "CONFIRMED",
      },
      include: {
        professional: true,
      },
    });

    return NextResponse.json({
      code: booking.code,
      barberPhone: booking.professional?.phone || "",
    });
  } catch (error: any) {
    console.error("Erro ao criar agendamento:", error);
    return NextResponse.json({ error: error.message || "Erro ao salvar agendamento." }, { status: 500 });
  }
}