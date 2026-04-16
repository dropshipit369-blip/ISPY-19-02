import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeSupabaseFunction } from "@/lib/supabase-functions";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Item, MarketReport } from "@/lib/types";

// eBay AU condition mapping
const CONDITION_MAP: Record<string, { id: string; description: string }> = {
  new: { id: "1000", description: "New" },
  "brand new": { id: "1000", description: "New" },
  sealed: { id: "1000", description: "New" },
  "like new": { id: "1500", description: "Like New" },
  mint: { id: "1500", description: "Like New" },
  excellent: { id: "2000", description: "Excellent - Refurbished" },
  "very good": { id: "2500", description: "Very Good" },
  great: { id: "2500", description: "Very Good" },
  good: { id: "3000", description: "Good" },
  fair: { id: "3000", description: "Good" },
  acceptable: { id: "4000", description: "Acceptable" },
  used: { id: "4000", description: "Acceptable" },
  poor: { id: "7000", description: "For parts or not working" },
  "for parts": { id: "7000", description: "For parts or not working" },
  broken: { id: "7000", description: "For parts or not working" },
};

function mapCondition(condition: string | null): {
  id: string;
  description: string;
} {
  if (!condition) return { id: "3000", description: "Good" };
  const key = condition.toLowerCase().trim();
  return CONDITION_MAP[key] ?? { id: "3000", description: "Good" };
}

export interface ListingDraftData {
  id?: string;
  item_id: string | null;
  title: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  condition_id: string;
  condition_description: string | null;
  price: number;
  currency: string;
  quantity: number;
  listing_format: "FIXED_PRICE" | "AUCTION";
  duration: string;
  photos: string[];
  item_specifics: Record<string, string>;
  shipping: {
    domestic: { service: string; cost: number; free: boolean };
    international?: { service: string; cost: number; locations: string[] } | null;
  };
  return_policy: { accepted: boolean; period: string; refund_method: string };
  location: string | null;
  postcode: string | null;
  ai_generated: boolean;
  status: string;
}

interface GeneratedListing {
  title: string;
  description: string;
  category_id: string | null;
  category_name: string | null;
  condition_id: string;
  condition_description: string;
  price: number;
  item_specifics: Record<string, string>;
  keywords: string[];
  shipping_weight_estimate: string | null;
}

interface UseListingDraftReturn {
  drafts: ListingDraftData[];
  loading: boolean;
  generating: boolean;
  saving: boolean;
  fetchDrafts: () => Promise<void>;
  generateDraft: (
    item: Item,
    marketReport: MarketReport | null,
  ) => Promise<ListingDraftData | null>;
  generateBatchDrafts: (
    items: Array<{ item: Item; marketReport: MarketReport | null }>,
  ) => Promise<ListingDraftData[]>;
  saveDraft: (draft: ListingDraftData) => Promise<string | null>;
  updateDraft: (
    id: string,
    updates: Partial<ListingDraftData>,
  ) => Promise<boolean>;
  deleteDraft: (id: string) => Promise<boolean>;
  regenerateField: (
    draft: ListingDraftData,
    field: "title" | "description" | "all",
    item: Item,
    marketReport: MarketReport | null,
  ) => Promise<Partial<ListingDraftData> | null>;
}

export function useListingDraft(): UseListingDraftReturn {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<ListingDraftData[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchDrafts = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("listing_drafts")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["draft", "review", "failed"])
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const mapped: ListingDraftData[] = (data ?? []).map((row) => ({
        id: row.id,
        item_id: row.item_id,
        title: row.title,
        description: row.description,
        category_id: row.category_id,
        category_name: row.category_name,
        condition_id: row.condition_id ?? "3000",
        condition_description: row.condition_description,
        price: Number(row.price),
        currency: row.currency,
        quantity: row.quantity,
        listing_format: row.listing_format as "FIXED_PRICE" | "AUCTION",
        duration: row.duration ?? "GTC",
        photos: (row.photos as string[]) ?? [],
        item_specifics: (row.item_specifics as Record<string, string>) ?? {},
        shipping: (row.shipping as ListingDraftData["shipping"]) ?? {
          domestic: { service: "AU_StandardDelivery", cost: 0, free: true },
        },
        return_policy: (row.return_policy as ListingDraftData["return_policy"]) ?? {
          accepted: true,
          period: "30_DAYS",
          refund_method: "MONEY_BACK",
        },
        location: row.location,
        postcode: row.postcode,
        ai_generated: row.ai_generated,
        status: row.status,
      }));

      setDrafts(mapped);
    } catch (err) {
      console.error("Error fetching drafts:", err);
      toast.error("Failed to load listing drafts");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const generateDraft = useCallback(
    async (
      item: Item,
      marketReport: MarketReport | null,
    ): Promise<ListingDraftData | null> => {
      if (!user) return null;
      setGenerating(true);

      try {
        const { data, error } = await invokeSupabaseFunction<{
          listing: GeneratedListing;
        }>("generate-ebay-listing", {
          item: {
            title: item.title,
            brand: item.brand,
            model: item.model,
            category: item.category,
            color: item.color,
            condition: item.condition,
            condition_score: item.condition_score,
            extracted_text: item.extracted_text,
            image_url: item.image_url,
          },
          market_report: marketReport
            ? {
                suggested_price: marketReport.suggested_price,
                median_price: marketReport.median_price,
                suggested_keywords: marketReport.suggested_keywords,
                sold_comparables: marketReport.sold_comparables,
                best_marketplace: marketReport.best_marketplace,
              }
            : null,
          options: {
            marketplace: "EBAY_AU",
            listing_format: "FIXED_PRICE",
            regenerate_field: "all",
          },
        });

        if (error || !data?.listing) {
          // Fallback: create draft from item data directly
          const condition = mapCondition(item.condition);
          const fallbackTitle =
            `${item.brand ?? ""} ${item.model ?? ""} ${item.title ?? ""} ${item.color ?? ""}`
              .trim()
              .slice(0, 80);

          const draft: ListingDraftData = {
            item_id: item.id,
            title: fallbackTitle,
            description: buildFallbackDescription(item),
            category_id: null,
            category_name: item.category,
            condition_id: condition.id,
            condition_description: condition.description,
            price:
              marketReport?.suggested_price ??
              marketReport?.median_price ??
              item.sale_price ??
              0,
            currency: "AUD",
            quantity: 1,
            listing_format: "FIXED_PRICE",
            duration: "GTC",
            photos: item.image_url ? [item.image_url] : [],
            item_specifics: buildItemSpecifics(item),
            shipping: {
              domestic: {
                service: "AU_StandardDelivery",
                cost: 0,
                free: true,
              },
            },
            return_policy: {
              accepted: true,
              period: "30_DAYS",
              refund_method: "MONEY_BACK",
            },
            location: "Australia",
            postcode: null,
            ai_generated: false,
            status: "draft",
          };

          return draft;
        }

        const listing = data.listing;
        const draft: ListingDraftData = {
          item_id: item.id,
          title: listing.title.slice(0, 80),
          description: listing.description,
          category_id: listing.category_id,
          category_name: listing.category_name,
          condition_id: listing.condition_id || mapCondition(item.condition).id,
          condition_description:
            listing.condition_description ||
            mapCondition(item.condition).description,
          price:
            listing.price ||
            (marketReport?.suggested_price ??
            marketReport?.median_price ??
            0),
          currency: "AUD",
          quantity: 1,
          listing_format: "FIXED_PRICE",
          duration: "GTC",
          photos: item.image_url ? [item.image_url] : [],
          item_specifics: listing.item_specifics || buildItemSpecifics(item),
          shipping: {
            domestic: { service: "AU_StandardDelivery", cost: 0, free: true },
          },
          return_policy: {
            accepted: true,
            period: "30_DAYS",
            refund_method: "MONEY_BACK",
          },
          location: "Australia",
          postcode: null,
          ai_generated: true,
          status: "draft",
        };

        return draft;
      } catch (err) {
        console.error("Error generating listing draft:", err);
        toast.error("Failed to generate listing — using manual mode");
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [user],
  );

  const generateBatchDrafts = useCallback(
    async (
      items: Array<{ item: Item; marketReport: MarketReport | null }>,
    ): Promise<ListingDraftData[]> => {
      setGenerating(true);
      const results: ListingDraftData[] = [];

      try {
        // Process in batches of 5 to avoid rate limiting
        const batchSize = 5;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const batchResults = await Promise.allSettled(
            batch.map(({ item, marketReport }) =>
              generateDraft(item, marketReport),
            ),
          );

          for (const result of batchResults) {
            if (result.status === "fulfilled" && result.value) {
              results.push(result.value);
            }
          }
        }

        toast.success(`Generated ${results.length} listing drafts`);
        return results;
      } catch (err) {
        console.error("Error generating batch drafts:", err);
        toast.error("Some listings failed to generate");
        return results;
      } finally {
        setGenerating(false);
      }
    },
    [generateDraft],
  );

  const saveDraft = useCallback(
    async (draft: ListingDraftData): Promise<string | null> => {
      if (!user) return null;
      setSaving(true);

      try {
        const row = {
          user_id: user.id,
          item_id: draft.item_id,
          platform: "ebay",
          status: draft.status || "draft",
          title: draft.title,
          description: draft.description,
          category_id: draft.category_id,
          category_name: draft.category_name,
          condition_id: draft.condition_id,
          condition_description: draft.condition_description,
          price: draft.price,
          currency: draft.currency,
          quantity: draft.quantity,
          listing_format: draft.listing_format,
          duration: draft.duration,
          photos: draft.photos,
          item_specifics: draft.item_specifics,
          shipping: draft.shipping,
          return_policy: draft.return_policy,
          location: draft.location,
          postcode: draft.postcode,
          ai_generated: draft.ai_generated,
        };

        if (draft.id) {
          // Update existing draft
          const { error } = await supabase
            .from("listing_drafts")
            .update(row)
            .eq("id", draft.id)
            .eq("user_id", user.id);

          if (error) throw error;
          return draft.id;
        } else {
          // Insert new draft
          const { data, error } = await supabase
            .from("listing_drafts")
            .insert(row)
            .select("id")
            .single();

          if (error) throw error;
          return data.id;
        }
      } catch (err) {
        console.error("Error saving draft:", err);
        toast.error("Failed to save listing draft");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [user],
  );

  const updateDraft = useCallback(
    async (
      id: string,
      updates: Partial<ListingDraftData>,
    ): Promise<boolean> => {
      if (!user) return false;

      try {
        const { error } = await supabase
          .from("listing_drafts")
          .update(updates)
          .eq("id", id)
          .eq("user_id", user.id);

        if (error) throw error;

        setDrafts((prev) =>
          prev.map((d) => (d.id === id ? { ...d, ...updates } : d)),
        );
        return true;
      } catch (err) {
        console.error("Error updating draft:", err);
        return false;
      }
    },
    [user],
  );

  const deleteDraft = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) return false;

      try {
        const { error } = await supabase
          .from("listing_drafts")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);

        if (error) throw error;

        setDrafts((prev) => prev.filter((d) => d.id !== id));
        toast.success("Draft deleted");
        return true;
      } catch (err) {
        console.error("Error deleting draft:", err);
        toast.error("Failed to delete draft");
        return false;
      }
    },
    [user],
  );

  const regenerateField = useCallback(
    async (
      draft: ListingDraftData,
      field: "title" | "description" | "all",
      item: Item,
      marketReport: MarketReport | null,
    ): Promise<Partial<ListingDraftData> | null> => {
      setGenerating(true);

      try {
        const { data, error } = await invokeSupabaseFunction<{
          listing: GeneratedListing;
        }>("generate-ebay-listing", {
          item: {
            title: item.title,
            brand: item.brand,
            model: item.model,
            category: item.category,
            color: item.color,
            condition: item.condition,
            condition_score: item.condition_score,
            extracted_text: item.extracted_text,
            image_url: item.image_url,
          },
          market_report: marketReport
            ? {
                suggested_price: marketReport.suggested_price,
                median_price: marketReport.median_price,
                suggested_keywords: marketReport.suggested_keywords,
              }
            : null,
          options: {
            marketplace: "EBAY_AU",
            listing_format: draft.listing_format,
            regenerate_field: field,
          },
        });

        if (error || !data?.listing) {
          toast.error("Failed to regenerate — try again");
          return null;
        }

        const updates: Partial<ListingDraftData> = {};
        if (field === "title" || field === "all") {
          updates.title = data.listing.title.slice(0, 80);
        }
        if (field === "description" || field === "all") {
          updates.description = data.listing.description;
        }
        if (field === "all") {
          updates.item_specifics = data.listing.item_specifics;
          updates.category_id = data.listing.category_id;
          updates.category_name = data.listing.category_name;
        }

        return updates;
      } catch (err) {
        console.error("Error regenerating field:", err);
        toast.error("Failed to regenerate");
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [],
  );

  return {
    drafts,
    loading,
    generating,
    saving,
    fetchDrafts,
    generateDraft,
    generateBatchDrafts,
    saveDraft,
    updateDraft,
    deleteDraft,
    regenerateField,
  };
}

// Helper: build fallback description from item data
function buildFallbackDescription(item: Item): string {
  const parts = [
    `<h3>${item.title || "Item for Sale"}</h3>`,
    "<ul>",
    item.brand ? `<li><strong>Brand:</strong> ${item.brand}</li>` : "",
    item.model ? `<li><strong>Model:</strong> ${item.model}</li>` : "",
    item.color ? `<li><strong>Colour:</strong> ${item.color}</li>` : "",
    item.condition
      ? `<li><strong>Condition:</strong> ${item.condition}</li>`
      : "",
    "</ul>",
    "<p>Please review photos carefully. What you see is what you get.</p>",
    "<p>Thank you for looking!</p>",
  ];
  return parts.filter(Boolean).join("\n");
}

// Helper: extract item specifics from item data
function buildItemSpecifics(item: Item): Record<string, string> {
  const specifics: Record<string, string> = {};
  if (item.brand) specifics["Brand"] = item.brand;
  if (item.model) specifics["Model"] = item.model;
  if (item.color) specifics["Colour"] = item.color;
  if (item.category) specifics["Type"] = item.category;
  return specifics;
}
