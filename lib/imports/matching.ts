import type { Sku, SkuMatchMethod, SkuMappingStatus } from "@/lib/supabase/database.types";

export type MatchInput = {
  sku: string;
  barcode?: string | null;
  productName?: string | null;
  variant?: string | null;
  packSize?: string | null;
};

export type SkuMatch = {
  skuId: string | null;
  status: SkuMappingStatus;
  method: SkuMatchMethod;
  confidence: number | null;
};

export function normalizeSku(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokens(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean));
}

export function productSimilarity(input: MatchInput, sku: Sku) {
  const left = tokens([input.productName, input.variant, input.packSize].filter(Boolean).join(" "));
  const right = tokens([sku.product_name, sku.variant, sku.pack_size].filter(Boolean).join(" "));
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return (2 * intersection) / (left.size + right.size);
}

export function matchSku(input: MatchInput, candidates: Sku[]): SkuMatch {
  if (input.barcode) {
    const barcodeMatches = candidates.filter((sku) => sku.barcode === input.barcode);
    if (barcodeMatches.length === 1) return { skuId: barcodeMatches[0].id, status: "mapped", method: "barcode", confidence: 1 };
    if (barcodeMatches.length > 1) return { skuId: null, status: "conflict", method: "barcode", confidence: 1 };
  }
  const exactMatches = candidates.filter((sku) => sku.master_sku.trim() === input.sku.trim());
  if (exactMatches.length === 1) return { skuId: exactMatches[0].id, status: "mapped", method: "exact_sku", confidence: 1 };
  if (exactMatches.length > 1) return { skuId: null, status: "conflict", method: "exact_sku", confidence: 1 };

  const normalized = normalizeSku(input.sku);
  const normalizedMatches = candidates.filter((sku) => normalizeSku(sku.master_sku) === normalized);
  if (normalizedMatches.length === 1) return { skuId: normalizedMatches[0].id, status: "mapped", method: "normalized_sku", confidence: 0.98 };
  if (normalizedMatches.length > 1) return { skuId: null, status: "conflict", method: "normalized_sku", confidence: 0.98 };

  const ranked = candidates.map((sku) => ({ sku, score: productSimilarity(input, sku) })).sort((a, b) => b.score - a.score);
  if (ranked[0]?.score >= 0.72) {
    if (ranked[1] && ranked[0].score - ranked[1].score < 0.04) {
      return { skuId: null, status: "conflict", method: "product_similarity", confidence: ranked[0].score };
    }
    return { skuId: ranked[0].sku.id, status: "suggested", method: "product_similarity", confidence: ranked[0].score };
  }
  return { skuId: null, status: "unmapped", method: "none", confidence: null };
}
