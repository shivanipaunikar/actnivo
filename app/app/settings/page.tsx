import { requireAppContext } from "@/lib/auth/session";
import { canManageInventory } from "@/lib/auth/roles";
import { defaultForecastSettings } from "@/lib/operations/forecasting";
import { createClient } from "@/lib/supabase/server";
import { saveOperatingSettings } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [query, context] = await Promise.all([searchParams, requireAppContext()]);
  const supabase = await createClient();
  const result = await supabase.from("organization_operating_settings").select("*").eq("organization_id", context.organization.id).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  const settings = result.data;
  const manageable = canManageInventory(context.role);
  return <div className="product-page settings-page"><header className="product-page-header"><div><p>PLATFORM</p><h1>Settings</h1><span>Configure deterministic forecasting and inventory protection thresholds.</span></div></header>{query.saved && <p className="product-alert success">Operating settings saved.</p>}{query.error && <p className="product-alert error">{query.error}</p>}
    <section className="settings-card"><header><small>FORECASTING POLICY</small><h2>Stockout protection</h2><p>These values are stored per organization and copied into every forecast calculation for audit.</p></header><form action={saveOperatingSettings}><label>Replenishment lead time<span>Days required for replenishment to arrive.</span><input type="number" name="replenishment_lead_time_days" min="0" max="365" defaultValue={settings?.replenishment_lead_time_days ?? defaultForecastSettings.leadTimeDays} disabled={!manageable} required /></label><label>Safety days<span>Extra coverage Actnivo protects beyond lead time.</span><input type="number" name="safety_days" min="0" max="365" defaultValue={settings?.safety_days ?? defaultForecastSettings.safetyDays} disabled={!manageable} required /></label><label>Minimum safety stock<span>Absolute units protected at every source.</span><input type="number" name="minimum_safety_stock" min="0" max="1000000" defaultValue={settings?.minimum_safety_stock ?? defaultForecastSettings.minimumSafetyStock} disabled={!manageable} required /></label><label>Target days of cover<span>Coverage a source must retain before transfer.</span><input type="number" name="target_days_of_cover" min="1" max="365" defaultValue={settings?.target_days_of_cover ?? defaultForecastSettings.targetDaysOfCover} disabled={!manageable} required /></label>{manageable ? <button className="saas-primary" type="submit">Save operating policy</button> : <p>Your workspace role can view but not change this policy.</p>}</form></section>
  </div>;
}
