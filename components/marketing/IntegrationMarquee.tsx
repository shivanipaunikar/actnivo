const platforms = ["Amazon", "Flipkart", "Shopify", "Meesho", "Blinkit", "Zepto", "Swiggy Instamart", "WooCommerce", "Unicommerce", "EasyEcom"];

export function IntegrationMarquee() {
  return <section className="platform-section" aria-label="Platforms and integrations"><div className="platform-intro"><small>PLATFORMS &amp; INTEGRATIONS</small><p>Built for everywhere commerce happens.</p></div><div className="marquee"><div>{platforms.map(name=><span key={name}>{name}</span>)}{platforms.map(name=><span aria-hidden="true" key={`${name}-duplicate`}>{name}</span>)}</div></div></section>;
}
