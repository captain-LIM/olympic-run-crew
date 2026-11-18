import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { unlockedVenues } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null, unlocked: [] });
  return NextResponse.json({ user: { id: user.id, nickname: user.nickname, ageGroup: user.ageGroup }, unlocked: await unlockedVenues(user.id) });
}
