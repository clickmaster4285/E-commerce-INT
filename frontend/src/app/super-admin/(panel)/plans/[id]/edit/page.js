"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { BadgeDollarSign } from "lucide-react";
import { PageHeader, Card, Button, EmptyState, Skeleton } from "@/components/superadmin/ui";
import PlanForm from "@/components/superadmin/PlanForm";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

const LIST = "/super-admin/plans";

export default function EditPlanPage() {
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["superadmin-plan", String(id)],
    queryFn: () => superAdminApi.getPlan(id),
    enabled: !!id,
    retry: 1,
  });
  const plan = data?.data?.plan || null;
  const detailHref = id ? `/super-admin/plans/${id}` : LIST;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit plan" backHref={detailHref} backLabel="Back to plan" />
        <Card className="space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (isError || !plan) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit plan" backHref={LIST} backLabel="Back to plans" />
        <Card>
          <EmptyState
            icon={BadgeDollarSign}
            title="This plan was not found"
            description="It may have been deleted."
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>
                <Button size="sm" variant="primary" href={LIST}>Back to plans</Button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  return <PlanForm plan={plan} />;
}
