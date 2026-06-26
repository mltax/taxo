import { Badge } from "@/components/ui/badge";
import type { ClaimStatus } from "@/lib/welfare/state";
import { STATUS_LABEL } from "@/lib/welfare/types";

const VARIANT: Record<ClaimStatus, "secondary" | "default" | "destructive" | "outline"> = {
  draft: "outline",
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  paid: "default",
};

export function StatusBadge({ status }: { status: ClaimStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
