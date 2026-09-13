import { AppSidebar } from "@/components/app/AppSidebar";
import { AppInteractionFeedback } from "@/components/app/AppInteractionFeedback";
import { requireAppContext } from "@/lib/auth/session";
import "./polish.css";
import "./sidebar-polish.css";
import "./interaction-polish.css";
import "./luxury-mvp.css";
import "./colorful-mvp.css";

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
      <AppInteractionFeedback />
    </main>
  );
}
