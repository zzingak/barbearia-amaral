import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { professionalId } = body;
    const numericId = parseInt(code, 10);

    const updatedAppointment = await db.appointment.updateMany({
      where: {
        OR: [
          { id: isNaN(numericId) ? 0 : numericId },
          { code: code }
        ],
      },
      data: {
        professionalId: Number(professionalId) || 1,
      },
    });

    return NextResponse.json({
      message: "Agendamento atualizado com sucesso!",
      updatedAppointment,
    });
  } catch (error: any) {
    console.error("Erro ao atualizar agendamento:", error);
    return NextResponse.json(
      { error: "Falha ao reagendar o agendamento." },
      { status: 500 }
    );
  }
}