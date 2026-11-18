import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Mascot } from "@/components/Mascot";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "로그인 | 공연 전 한 바퀴" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentUser()) redirect("/");
  return (
    <div className="band-sky grid items-center gap-x-[var(--gap-columns)] gap-y-8 lg:grid-cols-12">
      <div className="stack lg:col-span-6 lg:col-start-2">
        <h1 className="t-page">로그인</h1>
        <AuthForm mode="login" next={next} />
      </div>
      <div className="hidden justify-center lg:col-span-4 lg:flex">
        <Mascot pose="peek" priority sizes="320px" className="w-72" />
      </div>
    </div>
  );
}
