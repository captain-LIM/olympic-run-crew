import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "회원가입 | 공연 전 한 바퀴" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentUser()) redirect("/");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">회원가입</h1>
      <p className="text-sm text-slate-600">같은 공연을 보는 사람들과 번개를 열고 채팅하려면 계정이 필요해요. 실명과 전화번호는 받지 않아요.</p>
      <AuthForm mode="signup" next={next} />
    </div>
  );
}
