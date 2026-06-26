import { login } from "./actions";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="bg-cosmic relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* 별빛 레이어 */}
      <div className="bg-stars pointer-events-none absolute inset-0" />

      <Card className="relative z-10 w-full max-w-sm border-white/15 bg-white/95 shadow-2xl shadow-slate-950/50 backdrop-blur">
        <CardHeader className="items-center text-center">
          <div className="mb-2 grid h-16 w-20 place-items-center rounded-2xl bg-white shadow-md ring-1 ring-slate-200">
            <BrandLogo className="h-11 w-11" />
          </div>
          <CardTitle className="text-xl">세무법인 한영(창원)</CardTitle>
          <CardDescription>사내 시스템 · 관리자가 발급한 계정으로 로그인</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error === "invalid" && (
              <p className="text-sm text-destructive">
                이메일 또는 비밀번호가 올바르지 않습니다.
              </p>
            )}
            {error === "inactive" && (
              <p className="text-sm text-destructive">
                비활성화된 계정입니다. 관리자에게 문의하세요.
              </p>
            )}
            <Button type="submit" className="w-full">
              로그인
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="absolute bottom-4 z-10 text-center text-xs text-white/60">
        세무법인 한영(창원) · HanYeong Tax Accounting Corp.
      </p>
    </div>
  );
}
