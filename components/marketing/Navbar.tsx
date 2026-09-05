"use client";

import { useEffect, useState } from "react";
import { ActnivoMark } from "../brand/ActnivoMark";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 64); onScroll(); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); }, []);
  return <header className={`marketing-nav ${scrolled ? "is-scrolled" : ""}`}>
    <a className="marketing-brand" href="#top" aria-label="Actnivo home"><ActnivoMark />actnivo</a>
    <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>☰</button>
    <nav className={open ? "nav-open" : ""}>
      <a href="#product">Product</a><a href="#autopilot">Autopilot</a><a href="#integrations">Integrations</a><a href="/pricing">Pricing</a><a href="#developers">Developers</a>
    </nav>
    <div className="nav-actions"><a href="/dashboard">View Demo</a><a className="button button-small" href="#start">Request Access</a></div>
  </header>;
}
