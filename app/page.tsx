import { MarketingMotionProvider } from "../components/motion/MarketingMotionProvider";
import { Navbar } from "../components/marketing/Navbar";
import { Hero } from "../components/marketing/Hero";
import { IntegrationMarquee } from "../components/marketing/IntegrationMarquee";
import { ActionPlatform } from "../components/marketing/ActionPlatform";
import { AutopilotSpotlight } from "../components/marketing/AutopilotSpotlight";
import { AgentEverywhere } from "../components/marketing/AgentEverywhere";
import { QuickCommerceDemo } from "../components/marketing/QuickCommerceDemo";
import { IntegrationsGraph } from "../components/marketing/IntegrationsGraph";
import { ScaleMoment } from "../components/marketing/ScaleMoment";
import { DeveloperSection } from "../components/marketing/DeveloperSection";
import { FinalCTA } from "../components/marketing/FinalCTA";
import { Footer } from "../components/marketing/Footer";

export default function MarketingHome() {
  return <MarketingMotionProvider><main className="marketing-page"><Navbar/><Hero/><IntegrationMarquee/><ActionPlatform/><AutopilotSpotlight/><AgentEverywhere/><QuickCommerceDemo/><IntegrationsGraph/><ScaleMoment/><DeveloperSection/><FinalCTA/><Footer/></main></MarketingMotionProvider>;
}
