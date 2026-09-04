const platforms = ["Amazon", "Flipkart", "Shopify", "Meesho", "Blinkit", "Zepto", "Swiggy Instamart", "WooCommerce", "Unicommerce", "EasyEcom"];

export function IntegrationMarquee() {
  return <section className="platform-section"><p>One operating layer across everywhere you sell.</p><div className="marquee"><div>{[...platforms, ...platforms].map((name, index)=><span key={`${name}-${index}`}>{name}</span>)}</div></div></section>;
}
