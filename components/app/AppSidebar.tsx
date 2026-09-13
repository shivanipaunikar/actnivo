"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ActnivoMark } from "@/components/brand/ActnivoMark";
import type { OrganizationRole } from "@/lib/supabase/database.types";

const navigation = [
  { label: "Dashboard", href: "/app/dashboard", icon: "⌂" },
  { group: "OPERATIONS" },
  { label: "Ops Inbox", href: "/app/ops", icon: "◎" },
  { label: "Inventory", href: "/app/inventory", icon: "◇" },
  { label: "SKU Mapping", href: "/app/inventory/sku-mapping", icon: "↔" },
  { label: "Orders", href: "/app/orders", icon: "▦" },
  { label: "Purchase Orders", href: "/app/purchase-orders", icon: "▱" },
  { label: "Quick Commerce", href: "/app/quick-commerce", icon: "◫" },
  { label: "Returns & RTO", href: "/app/returns-rto", icon: "↩" },
  { group: "AUTOMATION" },
  { label: "Actions", href: "/app/actions", icon: "↯" },
  { label: "Autopilot", href: "/app/autopilot", icon: "◉" },
  { label: "AI Copilot", href: "/app/ai-copilot", icon: "✦" },
  { group: "INTELLIGENCE" },
  { label: "Analytics", href: "/app/analytics", icon: "⌁" },
  { label: "Profitability", href: "/app/profitability", icon: "₹" },
  { label: "Value Generated", href: "/app/value", icon: "↑" },
  { group: "PLATFORM" },
  { label: "Integrations", href: "/app/integrations", icon: "⇄" },
  { label: "Team", href: "/app/team", icon: "◌" },
  { label: "Settings", href: "/app/settings", icon: "⚙" },
] as const;

export function AppSidebar({ organizationName, userName, email, role }: { organizationName: string; userName: string; email: string; role: OrganizationRole; }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const initials = userName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <>
      <button className="saas-menu-toggle" type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}>☰</button>
      {open && <button className="saas-sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <aside className={`saas-sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <div className="saas-sidebar-head">
          <Link href="/app/dashboard" className="saas-brand" onClick={() => setOpen(false)}><ActnivoMark /><span>actnivo</span></Link>
          <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)}>×</button>
        </div>
        <button className="saas-sidebar-collapse" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? "›" : "‹"}</button>
        <div className="saas-workspace"><span>{organizationName.slice(0, 1).toUpperCase()}</span><div><small>WORKSPACE</small><strong>{organizationName}</strong></div></div>
        <nav aria-label="Application navigation">
          {navigation.map((item, index) => "group" in item ? (
            <p key={`${item.group}-${index}`}>{item.group}</p>
          ) : (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href || (item.href === "/app/inventory" && pathname.startsWith("/app/inventory/") && !pathname.startsWith("/app/inventory/sku-mapping")) || (item.href === "/app/actions" && pathname.startsWith("/app/actions/")) || (item.href === "/app/ops" && pathname.startsWith("/app/ops/")) ? "active" : ""} onClick={() => setOpen(false)}>
              <span aria-hidden="true">{item.icon}</span><strong>{item.label}</strong>
            </Link>
          ))}
        </nav>
        <div className="saas-user">
          <span>{initials || "A"}</span>
          <div><strong>{userName}</strong><small>{role.replace("_", " ")} · {email}</small></div>
          <form action="/logout" method="post"><button type="submit" aria-label="Sign out">↗</button></form>
        </div>
      </aside>
    </>
  );
}
