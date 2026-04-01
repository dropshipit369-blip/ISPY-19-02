import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, TrendingDown, Minus, DollarSign, Percent, Package } from "lucide-react";
import { formatAud } from "@/lib/utils";

interface PlatformFees {
  name: string;
  finalValueFee: number; // percentage
  paymentProcessing: number; // percentage
  fixedFee: number; // fixed amount in AUD
  description: string;
  notes?: string;
  flatFeeThreshold?: number;
  flatFeeBelowThreshold?: number;
}

export const PLATFORM_FEE_CONFIG: Record<string, PlatformFees> = {
  ebay_us: {
    name: "eBay Australia",
    finalValueFee: 13.25,
    paymentProcessing: 0,
    fixedFee: 0.30,
    description: "13.25% + A$0.30/order",
  },
  ebay_au: {
    name: "eBay Australia",
    finalValueFee: 13.0,
    paymentProcessing: 0,
    fixedFee: 0.30,
    description: "13% + A$0.30/order",
  },
  amazon_us: {
    name: "Amazon (Individual estimate)",
    finalValueFee: 15.0,
    paymentProcessing: 0,
    fixedFee: 0.99,
    description: "~15% referral + A$0.99/item",
    notes: "Category and seller plan can change this.",
  },
  amazon_au: {
    name: "Amazon Australia (estimate)",
    finalValueFee: 15.0,
    paymentProcessing: 0,
    fixedFee: 0.99,
    description: "~15% referral + A$0.99/item",
    notes: "Category and seller plan can change this.",
  },
  etsy: {
    name: "Etsy",
    finalValueFee: 6.5,
    paymentProcessing: 3.0,
    fixedFee: 0.45,
    description: "6.5% + 3% + A$0.45",
    notes: "Includes typical listing + payment fixed fees.",
  },
  mercari: {
    name: "Mercari",
    finalValueFee: 0,
    paymentProcessing: 0,
    fixedFee: 0,
    description: "0% seller fee",
    notes: "Policy can vary by region and payout method.",
  },
  poshmark: {
    name: "Poshmark",
    finalValueFee: 20,
    paymentProcessing: 0,
    fixedFee: 0,
    flatFeeThreshold: 15,
    flatFeeBelowThreshold: 2.95,
    description: "20% (or A$2.95 under A$15)",
  },
  depop: {
    name: "Depop",
    finalValueFee: 10,
    paymentProcessing: 3.3,
    fixedFee: 0.45,
    description: "10% + 3.3% + A$0.45",
  },
  facebook_local: {
    name: "Facebook Marketplace (Local)",
    finalValueFee: 0,
    paymentProcessing: 0,
    fixedFee: 0,
    description: "0% fees (local pickup)",
  },
  whatnot: {
    name: "Whatnot",
    finalValueFee: 8,
    paymentProcessing: 2.9,
    fixedFee: 0.30,
    description: "~8% + 2.9% + A$0.30",
    notes: "Rates vary by category/contract.",
  },
  custom: {
    name: "Custom Platform",
    finalValueFee: 0,
    paymentProcessing: 0,
    fixedFee: 0,
    description: "Set your own fees",
  },
};

interface ProfitCalculatorProps {
  suggestedPrice?: number;
  lowPrice?: number;
  highPrice?: number;
  defaultPlatform?: string;
  initialCostPrice?: string;
  initialSellingPrice?: string;
  onCostPriceChange?: (value: string) => void;
  onSellingPriceChange?: (value: string) => void;
}

export const ProfitCalculator: React.FC<ProfitCalculatorProps> = ({
  suggestedPrice,
  lowPrice,
  highPrice,
  defaultPlatform = "ebay_au",
  initialCostPrice,
  initialSellingPrice,
  onCostPriceChange,
  onSellingPriceChange,
}) => {
  const startingPlatform = PLATFORM_FEE_CONFIG[defaultPlatform] ? defaultPlatform : "ebay_au";
  const [platform, setPlatform] = useState(startingPlatform);
  const [costPrice, setCostPrice] = useState(initialCostPrice || "");
  const [sellingPrice, setSellingPrice] = useState(initialSellingPrice || suggestedPrice?.toFixed(2) || "");
  const [shippingCost, setShippingCost] = useState("");
  const [shippingCharged, setShippingCharged] = useState("");
  const [customFinalFee, setCustomFinalFee] = useState("10");
  const [customPaymentFee, setCustomPaymentFee] = useState("0");
  const [customFixedFee, setCustomFixedFee] = useState("0");

  useEffect(() => {
    if (PLATFORM_FEE_CONFIG[defaultPlatform]) {
      setPlatform(defaultPlatform);
    }
  }, [defaultPlatform]);

  useEffect(() => {
    if (typeof initialCostPrice === "string") {
      setCostPrice(initialCostPrice);
    }
  }, [initialCostPrice]);

  useEffect(() => {
    if (typeof initialSellingPrice === "string") {
      setSellingPrice(initialSellingPrice);
    }
  }, [initialSellingPrice]);

  const calculations = useMemo(() => {
    const cost = parseFloat(costPrice) || 0;
    const sale = parseFloat(sellingPrice) || 0;
    const shipCost = parseFloat(shippingCost) || 0;
    const shipCharged = parseFloat(shippingCharged) || 0;

    if (sale <= 0) {
      return null;
    }

    const platformData = PLATFORM_FEE_CONFIG[platform] || PLATFORM_FEE_CONFIG.ebay_au;
    const totalSaleAmount = sale + shipCharged;

    const customFinal = parseFloat(customFinalFee) || 0;
    const customPayment = parseFloat(customPaymentFee) || 0;
    const customFixed = parseFloat(customFixedFee) || 0;

    const finalValueFeeRate = platform === "custom" ? customFinal : platformData.finalValueFee;
    const paymentProcessingRate = platform === "custom" ? customPayment : platformData.paymentProcessing;

    let fixedFee = platform === "custom" ? customFixed : platformData.fixedFee;
    let percentageFees = totalSaleAmount * ((finalValueFeeRate + paymentProcessingRate) / 100);

    if (
      platformData.flatFeeThreshold &&
      platformData.flatFeeBelowThreshold !== undefined &&
      sale < platformData.flatFeeThreshold
    ) {
      percentageFees = 0;
      fixedFee = platformData.flatFeeBelowThreshold;
    }

    const totalFees = percentageFees + fixedFee;

    // Calculate profit
    const revenue = totalSaleAmount - totalFees;
    const totalCosts = cost + shipCost;
    const profit = revenue - totalCosts;
    const profitMargin = sale > 0 ? (profit / sale) * 100 : 0;
    const roi = cost > 0 ? (profit / cost) * 100 : 0;
    const totalFeeRate = finalValueFeeRate + paymentProcessingRate;

    return {
      salePrice: sale,
      shippingRevenue: shipCharged,
      totalRevenue: totalSaleAmount,
      platformFees: totalFees,
      feePercentage: totalFeeRate,
      finalValueFeeRate,
      paymentProcessingRate,
      fixedFee,
      itemCost: cost,
      shippingCost: shipCost,
      totalCosts,
      netRevenue: revenue,
      profit,
      profitMargin,
      roi,
    };
  }, [
    platform,
    costPrice,
    sellingPrice,
    shippingCost,
    shippingCharged,
    customFinalFee,
    customPaymentFee,
    customFixedFee,
  ]);

  const handleSuggestedPriceClick = useCallback((price: number) => {
    const value = price.toFixed(2);
    setSellingPrice(value);
    onSellingPriceChange?.(value);
  }, [onSellingPriceChange]);

  const getProfitColor = (profit: number) => {
    if (profit > 0) return "text-success";
    if (profit < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  const getProfitIcon = (profit: number) => {
    if (profit > 0) return <TrendingUp className="w-5 h-5" />;
    if (profit < 0) return <TrendingDown className="w-5 h-5" />;
    return <Minus className="w-5 h-5" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Profit Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform Selection */}
        <div className="space-y-2">
          <Label>Selling Platform</Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PLATFORM_FEE_CONFIG).map(([key, data]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex flex-col">
                    <span>{data.name}</span>
                    <span className="text-xs text-muted-foreground">{data.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {platform === "custom" && (
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-border/50 p-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Final Value %</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={customFinalFee}
                onChange={(e) => setCustomFinalFee(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment %</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={customPaymentFee}
                onChange={(e) => setCustomPaymentFee(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fixed Fee</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={customFixedFee}
                onChange={(e) => setCustomFixedFee(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Quick Price Buttons */}
        {(lowPrice || suggestedPrice || highPrice) && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Set Price</Label>
            <div className="flex flex-wrap gap-2">
              {lowPrice && (
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => handleSuggestedPriceClick(lowPrice)}
                >
                  Low: {formatAud(lowPrice)}
                </Badge>
              )}
              {suggestedPrice && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary/20"
                  onClick={() => handleSuggestedPriceClick(suggestedPrice)}
                >
                  Suggested: {formatAud(suggestedPrice)}
                </Badge>
              )}
              {highPrice && (
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => handleSuggestedPriceClick(highPrice)}
                >
                  High: {formatAud(highPrice)}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Cost & Price Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Item Cost
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={costPrice}
              onChange={(e) => {
                setCostPrice(e.target.value);
                onCostPriceChange?.(e.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Selling Price
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={sellingPrice}
              onChange={(e) => {
                setSellingPrice(e.target.value);
                onSellingPriceChange?.(e.target.value);
              }}
            />
          </div>
        </div>

        {/* Shipping Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-sm">
              <Package className="w-3 h-3" />
              Shipping Cost
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-sm">
              <Package className="w-3 h-3" />
              Shipping Charged
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={shippingCharged}
              onChange={(e) => setShippingCharged(e.target.value)}
            />
          </div>
        </div>

        {/* Results */}
        {calculations && (
          <div className="space-y-3 pt-4 border-t">
            {/* Breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sale Price</span>
                <span>{formatAud(calculations.salePrice)}</span>
              </div>
              {calculations.shippingRevenue > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">+ Shipping Charged</span>
                  <span>{formatAud(calculations.shippingRevenue)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Revenue</span>
                <span className="font-medium">{formatAud(calculations.totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-destructive">
                <span>
                  - Platform Fees ({calculations.feePercentage.toFixed(2)}%
                  {calculations.fixedFee > 0 ? ` + ${formatAud(calculations.fixedFee)}` : ""})
                </span>
                <span>{formatAud(-calculations.platformFees)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net After Fees</span>
                <span>{formatAud(calculations.netRevenue)}</span>
              </div>
              {calculations.itemCost > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>- Item Cost</span>
                  <span>{formatAud(-calculations.itemCost)}</span>
                </div>
              )}
              {calculations.shippingCost > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>- Shipping Cost</span>
                  <span>{formatAud(-calculations.shippingCost)}</span>
                </div>
              )}
            </div>

            {/* Profit Summary */}
            <div className={`rounded-xl p-4 ${calculations.profit >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Projected Profit (Per Item)</span>
                <div className={`flex items-center gap-1 text-xl font-bold ${getProfitColor(calculations.profit)}`}>
                  {getProfitIcon(calculations.profit)}
                  {formatAud(calculations.profit, { showPlus: true })}
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1">
                  <Percent className="w-3 h-3" />
                  <span className="text-muted-foreground">Margin:</span>
                  <span className={getProfitColor(calculations.profitMargin)}>
                    {calculations.profitMargin.toFixed(1)}%
                  </span>
                </div>
                {calculations.roi !== 0 && calculations.itemCost > 0 && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-muted-foreground">ROI:</span>
                    <span className={getProfitColor(calculations.roi)}>
                      {calculations.roi.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {PLATFORM_FEE_CONFIG[platform]?.notes && (
              <p className="text-[11px] text-muted-foreground">
                {PLATFORM_FEE_CONFIG[platform].notes}
              </p>
            )}
          </div>
        )}

        {!calculations && (
          <div className="text-center text-muted-foreground text-sm py-4">
            Enter a selling price to calculate profit
          </div>
        )}
      </CardContent>
    </Card>
  );
};
