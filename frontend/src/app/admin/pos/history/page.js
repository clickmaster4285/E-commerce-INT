import { redirect } from "next/navigation";

// History now lives inside the POS workspace.
export default function PosHistoryRedirect() {
  redirect("/admin/pos");
}
