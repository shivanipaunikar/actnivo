"use client";

import { useEffect, useState } from "react";
import { ActnivoMark } from "../brand/ActnivoMark";

const CONSENT_KEY = "actnivo-cookie-consent";

export function Footer() {
  const [showConsent, setShowConsent] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setShowConsent(window.localStorage.getItem(CONSENT_KEY) === null);
      } catch {
        setShowConsent(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function chooseConsent(choice: "accepted" | "rejected") {
    try {
      window.localStorage.setItem(CONSENT_KEY, choice);
    } catch {
      // The preference still applies for this page view when storage is unavailable.
    }
    setShowConsent(false);
  }

  return (
    <>
      <footer className="marketing-footer">
        <div className="footer-main section-shell">
          <div className="footer-intro">
            <a className="marketing-brand footer-brand" href="#top">
              <ActnivoMark />
              actnivo
            </a>
            <p>The AI operating system for commerce.</p>
            <small>Built for commerce in India.</small>
          </div>

          <div>
            <b>Product</b>
            <a href="#product">Product</a>
            <a href="#autopilot">Autopilot</a>
            <a href="#integrations">Integrations</a>
            <a href="/pricing">Pricing</a>
          </div>

          <div>
            <b>Resources</b>
            <a href="#developers">Developers</a>
            <a href="mailto:hello@actnivo.com?subject=Actnivo demo">Book a demo</a>
          </div>

          <div>
            <b>Company</b>
            <a href="#product">About us</a>
            <a href="mailto:hello@actnivo.com?subject=Careers at Actnivo">Careers</a>
            <a href="mailto:hello@actnivo.com">Contact us</a>
          </div>

          <div>
            <b>Connect</b>
            <a href="mailto:hello@actnivo.com?subject=Book an Actnivo call">Book a call</a>
            <a href="https://x.com/actnivo" target="_blank" rel="noreferrer">X (Twitter)</a>
            <a href="mailto:hello@actnivo.com?subject=Join Actnivo on Discord">Discord</a>
            <a href="mailto:hello@actnivo.com?subject=Join the Actnivo Slack community">Slack</a>
          </div>
        </div>

        <div className="footer-bottom section-shell">
          <span>© 2026 Actnivo. All rights reserved.</span>
          <span>Detect. Decide. Act. Verify.</span>
        </div>
      </footer>

      {showConsent && (
        <aside className="cookie-consent" role="dialog" aria-label="Cookie preferences" aria-live="polite">
          <p>We use cookies to improve your experience and understand how Actnivo is used.</p>
          <div>
            <button type="button" className="cookie-reject" onClick={() => chooseConsent("rejected")}>Reject</button>
            <button type="button" className="cookie-accept" onClick={() => chooseConsent("accepted")}>Accept</button>
          </div>
        </aside>
      )}
    </>
  );
}
