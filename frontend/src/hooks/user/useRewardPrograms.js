"use client";

import { useQuery } from "@tanstack/react-query";
import { loyaltyApi } from "@/apis/user/loyaltyApi";

/**
 * Rewards visibility — admin ka master "Rewards" switch off ho to
 * badge, nav aur referral samet saari reward UI chhup jati hai.
 */
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
    enabled: enabled && rewardsEnabled,
    staleTime: 60 * 1000,
    retry: false,
  });

  return {
    rewardsEnabled,
    referralEnabled: rewardsEnabled && Boolean(referralQuery.data?.enabled),
    isLoading: programQuery.isLoading || (rewardsEnabled && referralQuery.isLoading),
  };
}
