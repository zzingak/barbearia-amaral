import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BookingError } from "./booking";

/** Executa uma ação e transforma erros em respostas JSON amigáveis. */
export async function handle(fn: () => Promise<unknown>, status = 200) {
  try {
    return NextResponse.json(await fn(), { status });
  } catch (e) {
    if (e instanceof BookingError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    if (e instanceof ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Dados inválidos.", code: "INVALID" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro interno. Tente novamente.", code: "INTERNAL" }, { status: 500 });
  }
}
