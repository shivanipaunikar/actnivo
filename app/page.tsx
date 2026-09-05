import { MarketingMotionProvider } from "../components/motion/MarketingMotionProvider";
import { Navbar } from "../components/marketing/Navbar";
import { Hero } from "../components/marketing/Hero";
import { IntegrationMarquee } from "../components/marketing/IntegrationMarquee";
import { ProblemStatement } from "../components/marketing/ProblemStatement";
import { ActionStory } from "../components/marketing/ActionStory";
import { OpsInboxDemo } from "../components/marketing/OpsInboxDemo";
import { AICopilotDemo } from "../components/marketing/AICopilotDemo";
import { QuickCommerceDemo } from "../components/marketing/QuickCommerceDemo";
import { AutopilotDemo } from "../components/marketing/AutopilotDemo";
import { IntegrationsGraph } from "../components/marketing/IntegrationsGraph";
import { ValueGenerated } from "../components/marketing/ValueGenerated";
import { DeveloperSection } from "../components/marketing/DeveloperSection";
import { FinalCTA } from "../components/marketing/FinalCTA";
import { Footer } from "../components/marketing/Footer";

export default function MarketingHome() {
  return <MarketingMotionProvider><main className="marketing-page"><Navbar/><Hero/><IntegrationMarquee/><ProblemStatement/><ActionStory/><OpsInboxDemo/><AICopilotDemo/><QuickCommerceDemo/><AutopilotDemo/><IntegrationsGraph/><ValueGenerated/><DeveloperSection/><FinalCTA/><Footer/></main></MarketingMotionProvider>;
}
