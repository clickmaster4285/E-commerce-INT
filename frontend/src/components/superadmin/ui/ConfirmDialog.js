"use client";

import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

const TONE = {
  danger: { icon: AlertTriangle, iconTone: "danger", variant: "danger" },
  success: { icon: CheckCircle2, iconTone: "success", variant: "success" },
  primary: { icon: HelpCircle, iconTone: "accent", variant: "primary" },
};

/** Yes/no confirmation. confirmTone: danger | success | primary */
export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "danger",
  onCancel,
  onConfirm,
  loading = false,
}) {
  const t = TONE[confirmTone] || TONE.danger;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      icon={t.icon}
      iconTone={t.iconTone}
      size="sm"
      busy={loading}
      role="alertdialog"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={t.variant} onClick={onConfirm} loading={loading} autoFocus>{confirmLabel}</Button>
        </>
      }
    />
  );
}
