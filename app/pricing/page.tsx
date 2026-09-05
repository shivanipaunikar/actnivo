import { MarketingMotionProvider } from "../../components/motion/MarketingMotionProvider";
import { Navbar } from "../../components/marketing/Navbar";
import { PricingTeaser } from "../../components/marketing/PricingTeaser";
import { FinalCTA } from "../../components/marketing/FinalCTA";
import { Footer } from "../../components/marketing/Footer";

export default function PricingPage(){return <MarketingMotionProvider><main className="marketing-page pricing-page"><Navbar/><div className="pricing-page-spacer"/><PricingTeaser/><FinalCTA/><Footer/></main></MarketingMotionProvider>}
