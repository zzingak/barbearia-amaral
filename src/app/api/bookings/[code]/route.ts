import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const numericId = parseInt(code, 10);

    // Tenta deletar pelo ID numérico (ID do banco) ou pelo código (BARB-XXXXXX)
    if (!isNaN(numericId)) {
      await db.appointment.delete({
        where: { id: numericId },
      });
    } else {
      await db.appointment.delete({
        where: { code: code },
      });
    }

    return NextResponse.json({
      message: "Agendamento excluído do banco de dados com sucesso!",
    });
  } catch (error: any) {
    console.error("Erro ao deletar agendamento:", error);

    // Se o registro não for encontrado por ID, tenta a remoção via deleteMany
    try {
      const { code } = await params;
      await db.appointment.deleteMany({
        where: {
          OR: [
            { id: Number(code) || 0 },
            { code: code }
          ]
        }
      });
      return NextResponse.json({ message: "Agendamento removido." });
    } catch (err) {
      return NextResponse.json(
        { error: "Falha ao apagar agendamento do banco de dados." },
        { status: 500 }
      );
    }
  }
}