import { redirect } from "next/navigation";
import { createCompany } from "../actions";
import { getAppContext, requireAuthenticatedUser } from "@/lib/auth/session";

export default async function CompanyOnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireAuthenticatedUser("/onboarding/company");
  const context = await getAppContext(user);
  if (context) redirect(context.organization.onboardingCompletedAt ? "/app/dashboard" : "/onboarding/channels");
  const { error } = await searchParams;
  return <div className="onboarding-card"><div className="onboarding-progress"><span className="active">1</span><i /><span>2</span></div><p className="auth-eyebrow">STEP 1 OF 2</p><h1>Tell us about your company.</h1><p>We’ll use this to configure your workspace. You can change these details later.</p>{error && <div className="auth-message error">{error}</div>}<form action={createCompany} className="onboarding-form"><label htmlFor="company-name">Company name</label><input id="company-name" name="name" required minLength={2} placeholder="Nourish & Co." /><label htmlFor="company-website">Website <small>Optional</small></label><input id="company-website" name="website" inputMode="url" placeholder="yourbrand.com" /><label htmlFor="company-country">Country</label><select id="company-country" name="country" defaultValue="India"><option>India</option><option>Singapore</option><option>United Kingdom</option><option>United States</option></select><div className="onboarding-fields"><div><label htmlFor="monthly-orders">Monthly order volume</label><input id="monthly-orders" name="monthly_order_volume" type="number" min="0" required placeholder="10000" /></div><div><label htmlFor="sku-count">Number of SKUs</label><input id="sku-count" name="sku_count" type="number" min="0" required placeholder="250" /></div></div><button type="submit" className="saas-primary">Continue to channels →</button></form></div>;
}
