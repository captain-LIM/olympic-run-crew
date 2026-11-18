import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Mascot } from "@/components/Mascot";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "회원가입 | 공연 전 한 바퀴" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentUser()) redirect("/");
  return (
    <div className="band-sky grid items-center gap-x-[var(--gap-columns)] gap-y-8 lg:grid-cols-12">
      <div className="stack lg:col-span-6 lg:col-start-2">
      <h1 className="t-page">회원가입</h1>
      <p className="lead">같은 공연을 보는 사람들과 번개를 열고 채팅하려면 계정이 필요해요. 실명과 전화번호는 받지 않아요.</p>
      <AuthForm mode="signup" next={next} />
      </div>
      <div className="hidden justify-center lg:col-span-4 lg:flex">
        <Mascot pose="cheer" priority sizes="320px" className="w-72" />
      </div>
    </div>
  );
}
