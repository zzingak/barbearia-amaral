import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Força o Next.js a nunca usar resposta em cache nesta rota
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const appointments = await db.appointment.findMany({
      include: {
        service: true,
        professional: true,
        customer: true,
      },
      orderBy: {
        startsAt: "desc",
      },
    });

    return NextResponse.json(appointments);
  } catch (error: any) {
    console.error("Erro ao carregar agendamentos do admin:", error);
    return NextResponse.json(
      { error: "Falha ao carregar agendamentos." },
      { status: 500 }
    );
  }
}