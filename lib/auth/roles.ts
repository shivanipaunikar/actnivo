import type { OrganizationRole } from "@/lib/supabase/database.types";

const inventoryManagers = new Set<OrganizationRole>(["owner", "admin", "ops_manager", "inventory_manager"]);

export function canManageInventory(role: OrganizationRole) {
  return inventoryManagers.has(role);
}

export function assertCanManageInventory(role: OrganizationRole) {
  if (!canManageInventory(role)) throw new Error("Your workspace role cannot manage inventory imports.");
}
