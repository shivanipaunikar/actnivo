"use client";

import { useEffect } from "react";

export function AppInteractionFeedback() {
  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form || !form.closest(".saas-shell")) return;
      const submitter = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
      if (!submitter || submitter.disabled) return;
      submitter.classList.add("is-pending");
      submitter.setAttribute("aria-busy", "true");
      submitter.disabled = true;
      submitter.textContent = submitter.dataset.pendingText || "Working…";
    };

    const onChange = (event: Event) => {
      const input = event.target instanceof HTMLInputElement ? event.target : null;
      if (!input || input.type !== "file" || !input.closest(".file-drop")) return;
      const file = input.files?.[0];
      const drop = input.closest(".file-drop");
      const label = drop?.querySelector("span");
      const help = drop?.querySelector("small");
      if (file && label) label.textContent = `✓ ${file.name}`;
      if (file && help) help.textContent = "File selected · click here to change it";
      drop?.classList.toggle("has-file", Boolean(file));
    };

    document.addEventListener("submit", onSubmit);
    document.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("submit", onSubmit);
      document.removeEventListener("change", onChange);
    };
  }, []);

  return null;
}
