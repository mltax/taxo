import { requireUser } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">홈</h1>
      <p className="text-muted-foreground">
        {user.name} 님, 환영합니다. ({user.department ?? "부서 미지정"})
      </p>
      <p className="mt-6 text-sm text-muted-foreground">
        복지 청구·자료실 기능은 다음 단계에서 추가됩니다.
      </p>
    </div>
  );
}
