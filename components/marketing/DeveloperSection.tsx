import { Reveal } from "../motion/Reveal";

const requestCode = `// Request
{
  "channel": "blinkit",
  "sku": "VC-30",
  "source": "mumbai",
  "destination": "bangalore",
  "quantity": 70
}

// Response
{
  "action_id": "act_83922",
  "status": "executed",
  "value_protected": 28400
}`;

export function DeveloperSection(){return <section className="developer-section" id="developers"><div className="section-shell developer-grid"><Reveal><p className="marketing-eyebrow light">INFRASTRUCTURE</p><h2 className="section-title light">Built as infrastructure.<br/><span>Operated like software.</span></h2><p>Every Actnivo recommendation is an auditable action object — with policy checks, approvals, execution status and a verified outcome.</p><div className="dev-points"><span><i>01</i> Idempotent actions</span><span><i>02</i> Policy-based approvals</span><span><i>03</i> End-to-end audit trail</span></div></Reveal><Reveal variant="slideLeft" className="code-panel"><div className="code-preview-label">PRODUCT CONCEPT · API PREVIEW</div><div className="code-top"><span>POST</span><code>/v1/actions/replenishment</code><em>200 OK</em></div><div className="code-body"><div className="line-numbers">1<br/>2<br/>3<br/>4<br/>5<br/>6<br/>7<br/>8<br/>9<br/>10<br/>11<br/>12<br/>13<br/>14<br/>15</div><pre>{requestCode}</pre></div><div className="code-status"><span>Request</span><i>→</i><span>Policy checked</span><i>→</i><strong>Action created ✓</strong></div></Reveal></div></section>}
