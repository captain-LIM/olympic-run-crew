import { NextResponse } from "next/server";
import { getEvents } from "@/lib/data/rentals";

export async function GET() {
  const { events, source } = await getEvents();
  return NextResponse.json({ events, source });
}
