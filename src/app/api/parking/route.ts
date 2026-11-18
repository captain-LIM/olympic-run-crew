import { NextResponse } from "next/server";
import { getParking } from "@/lib/data/parking";

export const dynamic = "force-dynamic";

export async function GET() {
  const { parking, source } = await getParking();
  return NextResponse.json({ parking, source });
}
