import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";

const ROLE_LABEL: Record<string, string> = {
  staff: "팀원",
  approver: "팀장",
  hr_manager: "인사관리자",
  admin: "대표",
};

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">내 정보</h1>
      <Card>
        <CardHeader><CardTitle>계정</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">이름</span> · {user.name}</p>
          <p><span className="text-muted-foreground">이메일</span> · {user.email}</p>
          <p><span className="text-muted-foreground">소속/직위</span> · {user.department ?? "-"} / {ROLE_LABEL[user.role] ?? user.role}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>비밀번호 변경</CardTitle></CardHeader>
        <CardContent><ChangePasswordForm /></CardContent>
      </Card>
    </div>
  );
}
