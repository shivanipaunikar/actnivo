import Link from "next/link";
import { ActnivoMark } from "@/components/brand/ActnivoMark";
import { requireAuthenticatedUser } from "@/lib/auth/session";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedUser("/onboarding/company");
  return <main className="onboarding-shell"><header><Link href="/"><ActnivoMark />actnivo</Link><form action="/logout" method="post"><button type="submit">Sign out</button></form></header><section>{children}</section></main>;
}
