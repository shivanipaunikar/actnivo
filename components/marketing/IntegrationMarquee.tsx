const platforms = ["Amazon", "Flipkart", "Shopify", "Meesho", "Blinkit", "Zepto", "Swiggy Instamart", "WooCommerce", "Unicommerce", "EasyEcom"];

export function IntegrationMarquee() {
  return <section className="platform-section" aria-label="Supported integrations"><p>One operating layer across everywhere you sell.</p><div className="marquee"><div>{platforms.map(name=><span key={name}>{name}</span>)}{platforms.map(name=><span aria-hidden="true" key={`${name}-duplicate`}>{name}</span>)}</div></div></section>;
}
