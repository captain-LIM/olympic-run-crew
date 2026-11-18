import { NextResponse } from "next/server";
import { getShows } from "@/lib/data/shows";

export async function GET() {
  const { shows, source } = await getShows();
  return NextResponse.json({ shows, source });
}
