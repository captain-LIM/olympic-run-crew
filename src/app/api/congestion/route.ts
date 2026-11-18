import { NextResponse } from "next/server";
import { getCongestion } from "@/lib/data/congestion";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getCongestion());
}
