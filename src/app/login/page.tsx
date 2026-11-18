import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "로그인 | 공연 전 한 바퀴" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentUser()) redirect("/");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">로그인</h1>
      <AuthForm mode="login" next={next} />
    </div>
  );
}
