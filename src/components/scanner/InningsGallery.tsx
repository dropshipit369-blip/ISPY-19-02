/**
 * InningsGallery — SES §4: "Innings" Evidence-Based Pricing Engine
 *
 * Renders a Price Spread (Floor / Target / Ceiling) backed by a horizontal
 * scroll of verified Sold listings.  All data must come from Completed/Sold
 * marketplace listings only — active listings are never displayed here.
 *
 * Minimum 5 source items ("innings") are required for the component to render
 * in its full evidence-backed mode; fewer items shows a degraded estimate badge.
 */

import { ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatAud } from '@/lib/utils';

export interface InningItem {
  title: string;
  final_price: number;
  sale_date: string;
  thumbnail_url?: string;
  url?: string;
  marketplace: string;
  condition: string;
}

export interface PriceSpread {
  /** Minimum verified sold price (Floor) */
  floor: number;
  /** Statistical median of the dataset (Target) */
  target: number;
  /** Maximum verified premium sold price (Ceiling) */
  ceiling: number;
  /** True when data is from live Completed/Sold listings; false = cached estimate */
  isLive: boolean;
}

interface InningsGalleryProps {
  priceSpread: PriceSpread;
  innings: InningItem[];
  itemTitle: string;
}

const MINIMUM_INNINGS = 5;

function PriceBand({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-white/40 font-medium">{label}</span>
      <span className="text-lg font-bold text-white leading-none">{formatAud(value)}</span>
      <span className="text-[10px] text-white/40">{sub}</span>
    </div>
  );
}

function TrendIcon({ spread }: { spread: PriceSpread }) {
  const range = spread.ceiling - spread.floor;
  if (range === 0) return <Minus className="w-3 h-3 text-white/40" />;
  if (spread.target >= (spread.floor + spread.ceiling) / 2)
    return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  return <TrendingDown className="w-3 h-3 text-amber-400" />;
}

function InningCard({ item }: { item: InningItem }) {
  const dateLabel = (() => {
    const d = new Date(item.sale_date);
    return isNaN(d.getTime()) ? item.sale_date : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
  })();

  const inner = (
    <div className="flex-shrink-0 w-28 rounded-xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur">
      <div className="w-full h-20 bg-white/10 overflow-hidden">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">No image</div>
        )}
      </div>
      <div className="p-2 space-y-0.5">
        <p className="text-[10px] text-white/70 line-clamp-2 leading-tight">{item.title}</p>
        <p className="text-xs font-semibold text-emerald-400">{formatAud(item.final_price)}</p>
        <p className="text-[9px] text-white/40">{dateLabel}</p>
        {item.url && (
          <p className="text-[9px] text-primary/70 flex items-center gap-0.5">
            <ExternalLink className="w-2 h-2" />
            {item.marketplace}
          </p>
        )}
      </div>
    </div>
  );

  if (item.url) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    );
  }

  return inner;
}

/**
 * InningsGallery renders the Innings Evidence-Based Pricing UI.
 *
 * Shows a three-band price spread (Floor / Target / Ceiling) derived from
 * verified Sold listings, then a horizontal scroll of the source innings.
 */
export function InningsGallery({ priceSpread, innings, itemTitle }: InningsGalleryProps) {
  const hasFullEvidence = innings.length >= MINIMUM_INNINGS;

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/50 backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendIcon spread={priceSpread} />
          <span className="text-xs font-semibold text-white">Price Spread</span>
          <Badge
            variant="secondary"
            className={`text-[9px] px-1.5 py-0 h-4 ${
              priceSpread.isLive
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}
          >
            {priceSpread.isLive ? 'Live Sold Data' : 'Offline Estimate'}
          </Badge>
          {!hasFullEvidence && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-white/10 text-white/50 border-white/10">
              Limited Data
            </Badge>
          )}
        </div>
        <span className="text-[9px] text-white/30 truncate max-w-[120px]">{itemTitle}</span>
      </div>

      {/* Price Band */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2 border-b border-white/10">
        <PriceBand label="Floor" value={priceSpread.floor} sub="Min sold" />
        <div className="flex flex-col items-center gap-0.5 border-x border-white/10 px-2">
          <span className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-medium">Target</span>
          <span className="text-2xl font-bold text-emerald-400 leading-none">{formatAud(priceSpread.target)}</span>
          <span className="text-[10px] text-white/40">Median</span>
        </div>
        <PriceBand label="Ceiling" value={priceSpread.ceiling} sub="Max sold" />
      </div>

      {/* Innings Horizontal Gallery */}
      {innings.length > 0 ? (
        <div className="px-3 py-3">
          <p className="text-[9px] uppercase tracking-widest text-white/30 mb-2">
            {innings.length} sold {innings.length === 1 ? 'comparable' : 'comparables'} · Completed listings only
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
            {innings.map((item, i) => (
              <div key={i} className="snap-start">
                <InningCard item={item} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 text-[10px] text-white/30 italic">
          No sold comparables available for this item.
        </div>
      )}
    </div>
  );
}
