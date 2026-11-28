"use client";

import { useQuery } from "@tanstack/react-query";
import { loyaltyApi } from "@/apis/user/loyaltyApi";

/** Rewards and referral visibility use their own admin switches. */
export function useRewardPrograms({ enabled = true } = {}) {
  const programQuery = useQuery({
    queryKey: ["loyaltyProgram"],
    queryFn: loyaltyApi.program,
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });

  const rewardsEnabled = Boolean(programQuery.data?.enabled);

  const referralQuery = useQuery({
    queryKey: ["my-referrals"],
    queryFn: loyaltyApi.referrals,
    enabled,
    staleTime: 0,
    retry: false,
  });

  return {
    rewardsEnabled,
    referralEnabled: Boolean(referralQuery.data?.enabled),
    isLoading: programQuery.isLoading || referralQuery.isLoading,
  };
}
