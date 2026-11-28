"use client";

/**
 * Place Order se pehle reward claim popup kholne ka chhota bridge.
 * Modal is event ko sunta hai aur Claim par resolve(true), close par resolve(false).
 */
export function requestRewardClaim(points) {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.__rewardClaimListener) {
      resolve(true);
      return;
    }
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(Boolean(value));
    };
    window.dispatchEvent(new CustomEvent("loyalty:claim-request", {
      detail: { points: Number(points) || 0, resolve: finish },
    }));
  });
}
