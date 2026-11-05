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
    const professionalId = searchParams.get("professionalId") || searchParams.get("barberId");

    const whereClause: any = {};
    if (professionalId && professionalId !== "admin" && professionalId !== "all") {
      whereClause.professionalId = Number(professionalId);
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
  } catch (error: any) {
    console.error("Erro ao carregar agendamentos do admin:", error);
    return NextResponse.json({ error: "Erro ao buscar agendamentos." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID não informado." }, { status: 400 });
    }

    await db.booking.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao deletar agendamento:", error);
    return NextResponse.json({ error: "Erro ao excluir agendamento." }, { status: 500 });
  }
}