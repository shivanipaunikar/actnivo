import { redirect } from "next/navigation";
import { saveChannels } from "../actions";
import { getAppContext, requireAuthenticatedUser } from "@/lib/auth/session";
import { supportedChannels } from "@/lib/data/organizations";

export default async function ChannelOnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireAuthenticatedUser("/onboarding/channels");
  const context = await getAppContext(user);
  if (!context) redirect("/onboarding/company");
  if (context.organization.onboardingCompletedAt) redirect("/app/dashboard");
  const { error } = await searchParams;
  return <div className="onboarding-card wide"><div className="onboarding-progress"><span className="done">✓</span><i className="done" /><span className="active">2</span></div><p className="auth-eyebrow">STEP 2 OF 2</p><h1>Where do you sell?</h1><p>Select every channel you use today. This does not connect accounts yet.</p>{error && <div className="auth-message error">{error}</div>}<form action={saveChannels} className="onboarding-form"><fieldset className="channel-picker"><legend>Commerce channels</legend>{supportedChannels.map(({ value, label }) => <label key={value}><input type="checkbox" name="channels" value={value} /><span>{label.slice(0, 1)}</span><strong>{label}</strong><i>✓</i></label>)}</fieldset><label htmlFor="other-channel">Other channel name <small>Required only if Other is selected</small></label><input id="other-channel" name="other_channel" placeholder="Custom marketplace or ERP" /><button type="submit" className="saas-primary">Create workspace →</button></form></div>;
}
