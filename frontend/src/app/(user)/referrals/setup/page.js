import { redirect } from "next/navigation";

export default function ReferralSetupPage() {
  redirect("/account?tab=referrals");
}
