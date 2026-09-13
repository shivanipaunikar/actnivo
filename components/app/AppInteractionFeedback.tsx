"use client";

import { useEffect } from "react";

export function AppInteractionFeedback() {
  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form =
        event.target instanceof HTMLFormElement ? event.target : null;

      if (!form || !form.closest(".saas-shell")) return;

      const submitter =
        event.submitter instanceof HTMLButtonElement
          ? event.submitter
          : null;

      if (!submitter || submitter.disabled) return;

      submitter.classList.add("is-pending");
      submitter.setAttribute("aria-busy", "true");
      submitter.disabled = true;
      submitter.textContent =
        submitter.dataset.pendingText || "Working…";
    };

    document.addEventListener("submit", onSubmit);

    return () => {
      document.removeEventListener("submit", onSubmit);
    };
  }, []);

  return null;
}
