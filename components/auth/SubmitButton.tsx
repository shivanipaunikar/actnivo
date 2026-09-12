"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="auth-primary" type="submit" disabled={pending}>
      {pending ? "Please wait…" : children}
    </button>
  );
}
