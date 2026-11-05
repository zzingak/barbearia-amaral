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

export async function GET() {
  try {
    let barbers = await db.professional.findMany({
      orderBy: { id: "asc" },
    });

    const expectedNames = ["Davi", "Caio", "Lucas"];
    const currentNames = barbers.map((b) => b.name);

    const needsReset =
      barbers.length !== 3 ||
      !expectedNames.every((name) => currentNames.includes(name));

    if (needsReset) {
      await db.booking.deleteMany({});
      await db.professional.deleteMany({});

      await db.professional.createMany({
        data: [
          { id: 1, name: "Davi", phone: "557398309182", password: "1234", notificationsActive: true },
          { id: 2, name: "Caio", phone: "557398309182", password: "1234", notificationsActive: true },
          { id: 3, name: "Lucas", phone: "557398309182", password: "1234", notificationsActive: true },
        ],
      });

      barbers = await db.professional.findMany({
        orderBy: { id: "asc" },
      });
    }

    return NextResponse.json(barbers);
  } catch (error: any) {
    console.error("Erro ao buscar barbeiros:", error);
    return NextResponse.json({ error: "Erro ao buscar barbeiros." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, phone, password, notificationsActive, resetPassword } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (notificationsActive !== undefined) updateData.notificationsActive = notificationsActive;
    
    // Se o admin pediu reset para 1234 ou se o barbeiro enviou uma nova senha
    if (resetPassword) {
      updateData.password = "1234";
    } else if (password !== undefined) {
      if (String(password).length !== 4) {
        return NextResponse.json({ error: "A senha deve ter exatamente 4 dígitos." }, { status: 400 });
      }
      updateData.password = String(password);
    }

    const updated = await db.professional.update({
      where: { id: Number(id) },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Erro ao atualizar barbeiro:", error);
    return NextResponse.json({ error: "Erro ao atualizar dados." }, { status: 500 });
  }
}