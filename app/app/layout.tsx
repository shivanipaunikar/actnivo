import { AppSidebar } from "@/components/app/AppSidebar";
import { requireAppContext } from "@/lib/auth/session";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAppContext();
  return (
    <main className="saas-shell">
      <AppSidebar
        organizationName={context.organization.name}
        userName={context.user.fullName}
        email={context.user.email}
        role={context.role}
      />
      <section className="saas-content">{children}</section>
    </main>
  );
}
