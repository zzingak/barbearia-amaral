import { cancelBooking, toPublic } from "@/lib/booking";
import { handle } from "@/lib/http";
import { bookingCode } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { code: string } }) {
  return handle(async () => toPublic(await cancelBooking(bookingCode.parse(params.code))));
}
