import Link from "next/link";
import { importReturnsRto } from "./actions";

export default async function ReturnImportPage({searchParams}:{searchParams:Promise<{error?:string}>}){
  const query=await searchParams;
  return <div className="product-page"><header className="product-page-header"><div><p>RETURNS & RTO</p><h1>Import return/RTO file</h1><span>Bootstrap historical or disconnected reverse-logistics data. API connectors will feed the same normalized model later.</span></div><Link href="/app/returns-rto">← Back</Link></header>{query.error&&<p className="product-alert error">{query.error}</p>}<section className="product-card" style={{maxWidth:760}}><header><div><small>CSV / XLSX</small><h2>Return and RTO records</h2></div></header><form action={importReturnsRto} style={{display:"grid",gap:16,padding:24}}><input type="file" name="file" accept=".csv,.xlsx" required/><button className="saas-primary" type="submit">Import returns & RTO</button></form><div style={{padding:"0 24px 24px"}}><small>Required columns</small><p>Return ID, Order ID, Kind, Requested At, SKU, Quantity, Unit Value. Optional: Status, Reason, Refund Amount, Reverse Logistics Cost, Pickup/Receipt/Refund dates.</p></div></section></div>;
}
