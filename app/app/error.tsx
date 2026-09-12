"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="saas-error"><small>WORKSPACE ERROR</small><h1>Something didn’t load.</h1><p>Your data has not been changed. Try loading this view again.</p><button type="button" onClick={reset}>Try again</button></div>;
}
