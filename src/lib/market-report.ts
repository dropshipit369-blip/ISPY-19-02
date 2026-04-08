import type { Json } from '@/integrations/supabase/types';
import type { MarketReport, MarketReportDraft, SoldComparable } from '@/lib/types';

type MarketReportLike = MarketReport | MarketReportDraft;

export function getVerifiedSoldComparables(marketReport?: MarketReportLike | null): SoldComparable[] {
  return (marketReport?.sold_comparables || []).filter(
    (comp): comp is SoldComparable => Boolean(comp && typeof comp.price === 'number' && comp.price > 0),
  );
}

export function hasVerifiedMarketData(marketReport?: MarketReportLike | null): boolean {
  return getVerifiedSoldComparables(marketReport).length > 0;
}

export function getMarketVerificationMessage(marketReport?: MarketReportLike | null): string {
  const message = marketReport?.verification_message?.trim();
  return message || 'Insufficient Market Data - Manual Entry Required.';
}

export function buildMarketReportInsertPayload(
  marketReport: MarketReportLike,
  itemId: string,
  listingPrice?: string | number | null,
) {
  const hasVerifiedData = hasVerifiedMarketData(marketReport);
  const confidence = marketReport.confidence_score;
  const normalizedConfidence =
    confidence !== null && confidence !== undefined && confidence <= 1
      ? Math.round(confidence * 100)
      : Math.round(confidence || 0);
  const parsedListingPriceCandidate =
    typeof listingPrice === 'number'
      ? listingPrice
      : typeof listingPrice === 'string' && listingPrice.trim().length > 0
        ? parseFloat(listingPrice)
        : null;
  const parsedListingPrice =
    parsedListingPriceCandidate !== null && Number.isFinite(parsedListingPriceCandidate)
      ? parsedListingPriceCandidate
      : null;

  return {
    item_id: itemId,
    low_price: hasVerifiedData ? marketReport.low_price : null,
    median_price: hasVerifiedData ? marketReport.median_price : null,
    high_price: hasVerifiedData ? marketReport.high_price : null,
    avg_days_to_sell: hasVerifiedData && marketReport.avg_days_to_sell
      ? Math.round(marketReport.avg_days_to_sell)
      : null,
    price_trend: hasVerifiedData ? marketReport.price_trend : null,
    trend_percentage: hasVerifiedData ? marketReport.trend_percentage : null,
    confidence_score: hasVerifiedData ? normalizedConfidence : null,
    best_marketplace: hasVerifiedData ? marketReport.best_marketplace : null,
    suggested_price: parsedListingPrice ?? (hasVerifiedData ? marketReport.suggested_price : null),
    listing_type: hasVerifiedData ? marketReport.listing_type || null : null,
    best_day_to_list: hasVerifiedData ? marketReport.best_day_to_list || null : null,
    suggested_title: hasVerifiedData ? marketReport.suggested_title || null : null,
    suggested_description: hasVerifiedData ? marketReport.suggested_description || null : null,
    suggested_keywords: hasVerifiedData ? marketReport.suggested_keywords || null : null,
    shipping_recommendation: hasVerifiedData ? marketReport.shipping_recommendation || null : null,
    data_sources: hasVerifiedData ? marketReport.data_sources || {} : {},
    sold_comparables: (hasVerifiedData ? marketReport.sold_comparables || [] : []) as unknown as Json,
    verification_status: hasVerifiedData ? 'verified' : 'manual_required',
    verification_source: hasVerifiedData ? marketReport.verification_source || null : null,
    verification_message: hasVerifiedData ? null : getMarketVerificationMessage(marketReport),
    verified_comps_count: hasVerifiedData ? marketReport.verified_comps_count || getVerifiedSoldComparables(marketReport).length : 0,
  };
}
