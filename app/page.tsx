import { MarketingMotionProvider } from "../components/motion/MarketingMotionProvider";
import { Navbar } from "../components/marketing/Navbar";
import { Hero } from "../components/marketing/Hero";
import { IntegrationMarquee } from "../components/marketing/IntegrationMarquee";
import { ProblemStatement } from "../components/marketing/ProblemStatement";
import { ActionStory } from "../components/marketing/ActionStory";
import { OpsInboxDemo } from "../components/marketing/OpsInboxDemo";
import { RevenueImpact } from "../components/marketing/RevenueImpact";
import { AICopilotDemo } from "../components/marketing/AICopilotDemo";
import { WhatsAppAgent } from "../components/marketing/WhatsAppAgent";
import { QuickCommerceDemo } from "../components/marketing/QuickCommerceDemo";
import { AutopilotDemo } from "../components/marketing/AutopilotDemo";
import { ActionVerification } from "../components/marketing/ActionVerification";
import { IntegrationsGraph } from "../components/marketing/IntegrationsGraph";
import { ValueGenerated } from "../components/marketing/ValueGenerated";
import { DeveloperSection } from "../components/marketing/DeveloperSection";
import { PricingTeaser } from "../components/marketing/PricingTeaser";
import { FinalCTA } from "../components/marketing/FinalCTA";
import { Footer } from "../components/marketing/Footer";

export default function MarketingHome() {
  return <MarketingMotionProvider><main className="marketing-page"><Navbar/><Hero/><IntegrationMarquee/><ProblemStatement/><ActionStory/><OpsInboxDemo/><RevenueImpact/><AICopilotDemo/><WhatsAppAgent/><QuickCommerceDemo/><AutopilotDemo/><ActionVerification/><IntegrationsGraph/><ValueGenerated/><DeveloperSection/><PricingTeaser/><FinalCTA/><Footer/></main></MarketingMotionProvider>;
}
