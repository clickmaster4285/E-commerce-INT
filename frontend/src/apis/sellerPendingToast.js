import { toast } from "sonner";

// Professional, deduplicated notice shown whenever a pending seller tries to
// change anything in the admin panel (view-only until Super Admin approval).
export const notifySellerPendingLocked = () => {
  toast("Pending approval — action locked", {
    id: "seller-pending-locked",
    description:
      "Your store application is awaiting Super Admin approval. You can view everything, but changes unlock once you're approved — we'll email you.",
    duration: 5000,
    style: {
      borderLeft: "3px solid #f59e0b",
      background: "#fffbeb",
      color: "#78350f",
    },
  });
};
