import Link from "next/link";
import { ActnivoMark } from "@/components/brand/ActnivoMark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell">
      <Link className="auth-brand" href="/">
        <ActnivoMark />
        <span>actnivo</span>
      </Link>
      <section className="auth-panel">{children}</section>
      <p className="auth-footnote">Secure commerce operations for modern Indian brands.</p>
    </main>
  );
}
