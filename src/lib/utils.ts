import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AudFormatOptions {
  decimals?: number;
  fallback?: string;
  showPlus?: boolean;
}

const getAudNumberFormatter = (decimals: number) =>
  new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export function formatAud(
  value: number | null | undefined,
  options: AudFormatOptions = {},
) {
  const { decimals = 2, fallback = "—", showPlus = false } = options;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const sign = value < 0 ? "-" : showPlus && value > 0 ? "+" : "";
  const formatted = getAudNumberFormatter(decimals).format(Math.abs(value));
  return `${sign}A$${formatted}`;
}

export function formatAudRange(
  low: number | null | undefined,
  high: number | null | undefined,
  options: AudFormatOptions = {},
) {
  const hasLow = typeof low === "number" && Number.isFinite(low);
  const hasHigh = typeof high === "number" && Number.isFinite(high);

  if (!hasLow && !hasHigh) {
    return options.fallback ?? "—";
  }

  if (hasLow && hasHigh) {
    return `${formatAud(low, options)} - ${formatAud(high, options)}`;
  }

  return formatAud((hasLow ? low : high) ?? null, options);
}
