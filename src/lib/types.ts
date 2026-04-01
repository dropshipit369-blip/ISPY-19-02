export interface Item {
  id: string;
  user_id: string;
  image_url: string;
  title: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  color: string | null;
  condition: string | null;
  condition_score: number | null;
  extracted_text: string | null;
  barcode: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  sold_at: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SoldComparable {
  title: string;
  price: number;
  marketplace: string;
  condition: string;
  timeframe: string;
  url?: string;
}

export interface MarketReport {
  id: string;
  item_id: string;
  low_price: number | null;
  median_price: number | null;
  high_price: number | null;
  avg_days_to_sell: number | null;
  price_trend: 'up' | 'down' | 'stable' | null;
  trend_percentage: number | null;
  confidence_score: number | null;
  best_marketplace: string | null;
  suggested_price: number | null;
  listing_type: 'auction' | 'fixed' | null;
  best_day_to_list: string | null;
  suggested_title: string | null;
  suggested_description: string | null;
  suggested_keywords: string[] | null;
  shipping_recommendation: string | null;
  sold_comparables: SoldComparable[] | null;
  data_sources: {
    ebay?: { listings: number; avgPrice: number };
    amazon?: { listings: number; avgPrice: number };
    etsy?: { listings: number; avgPrice: number };
    poshmark?: { listings: number; avgPrice: number };
    grailed?: { listings: number; avgPrice: number };
    stockx?: { listings: number; avgPrice: number };
  } | null;
  verification_status?: 'verified' | 'manual_required';
  verification_source?: string | null;
  verification_message?: string | null;
  verified_comps_count?: number | null;
  created_at: string;
}

export type MarketReportDraft =
  Omit<MarketReport, "id" | "item_id" | "created_at"> &
  Partial<Pick<MarketReport, "id" | "item_id" | "created_at">>;

export interface ItemWithReport extends Item {
  market_reports?: MarketReport[];
}

export interface PriceAlert {
  id: string;
  item_id: string;
  user_id: string;
  target_price: number;
  alert_type: 'above' | 'below';
  triggered: boolean;
  triggered_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisResult {
  title: string;
  brand: string | null;
  model: string | null;
  category: string;
  color: string | null;
  condition: string;
  conditionScore: number;
  extractedText: string | null;
  barcode: string | null;
  marketReport: {
    lowPrice: number;
    medianPrice: number;
    highPrice: number;
    avgDaysToSell: number;
    priceTrend: 'up' | 'down' | 'stable';
    trendPercentage: number;
    confidenceScore: number;
    bestMarketplace: string;
    suggestedPrice: number;
    listingType: 'auction' | 'fixed';
    bestDayToList: string;
    suggestedTitle: string;
    suggestedDescription: string;
    suggestedKeywords: string[];
    shippingRecommendation: string;
    soldComparables: SoldComparable[];
    dataSources: {
      ebay?: { listings: number; avgPrice: number };
      amazon?: { listings: number; avgPrice: number };
      etsy?: { listings: number; avgPrice: number };
      poshmark?: { listings: number; avgPrice: number };
      grailed?: { listings: number; avgPrice: number };
      stockx?: { listings: number; avgPrice: number };
    };
    verificationStatus?: 'verified' | 'manual_required';
    verificationSource?: string | null;
    verificationMessage?: string | null;
    verifiedCompsCount?: number | null;
  };
}
