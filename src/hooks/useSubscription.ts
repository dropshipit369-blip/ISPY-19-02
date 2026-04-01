import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { invokeSupabaseFunction, parseSupabaseFunctionError } from "@/lib/supabase-functions";

export interface SubscriptionStatus {
  subscribed: boolean;
  planType: "free" | "pro" | "unlimited";
  subscriptionEnd: string | null;
  scansUsed: number;
  scansLimit: number; // -1 for unlimited
  loading: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    planType: "free",
    subscriptionEnd: null,
    scansUsed: 0,
    scansLimit: 5, // Default to free tier limit
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const { data, error } = await invokeSupabaseFunction<{
        subscribed: boolean;
        plan_type?: "free" | "pro" | "unlimited";
        subscription_end: string | null;
        scans_used?: number;
        scans_limit?: number;
      }>("check-subscription");

      if (error) {
        const message = await parseSupabaseFunctionError(error, "Subscription check failed.");
        console.error("Error checking subscription:", message, error);
        setStatus(prev => ({
          ...prev,
          subscribed: false,
          planType: "free",
          loading: false,
          scansLimit: prev.scansLimit > 0 ? prev.scansLimit : 5,
        }));
        return;
      }

      setStatus({
        subscribed: data.subscribed,
        planType: data.plan_type || "free",
        subscriptionEnd: data.subscription_end,
        scansUsed: data.scans_used || 0,
        scansLimit: data.scans_limit ?? 0,
        loading: false,
      });
    } catch (error) {
      const message = await parseSupabaseFunctionError(error, "Subscription check failed.");
      console.error("Failed to check subscription:", message, error);
      // On error, default to free tier to avoid blocking the user
      setStatus(prev => ({
        ...prev,
        subscribed: false,
        planType: "free",
        loading: false,
        scansLimit: prev.scansLimit || 5, // Ensure fallback
      }));
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();

    // Refresh every minute
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const canUseLiveScanner = useCallback(() => {
    if (status.planType === "unlimited") return { allowed: true, reason: null };
    if (status.planType === "pro") {
      if (status.scansUsed >= status.scansLimit) {
        return { allowed: false, reason: "You've used all 50 live scans this month. Upgrade to Unlimited for unlimited scans." };
      }
      return { allowed: true, reason: null };
    }
    // Free users get 5 scans
    if (status.scansUsed >= status.scansLimit && status.scansLimit > 0) {
      return { allowed: false, reason: "You've used all 5 free live scans this month. Upgrade to Pro for 50 scans or Unlimited for unlimited scans." };
    }
    if (status.scansLimit > 0) {
      return { allowed: true, reason: null };
    }
    return { allowed: false, reason: "Live scanning requires a membership." };
  }, [status]);

  const getRemainingScans = useCallback(() => {
    if (status.planType === "unlimited") return -1; // Unlimited
    return Math.max(0, status.scansLimit - status.scansUsed);
  }, [status]);

  const incrementScanUsage = useCallback(async (itemsIdentified: number = 1) => {
    if (!user) return;

    const currentMonth = new Date().toISOString().slice(0, 7);

    try {
      // Try to update existing record
      const { data: existing } = await supabase
        .from("live_scan_usage")
        .select("*")
        .eq("user_id", user.id)
        .eq("month_year", currentMonth)
        .single();

      if (existing) {
        await supabase
          .from("live_scan_usage")
          .update({
            scan_count: existing.scan_count + 1,
            items_identified: existing.items_identified + itemsIdentified,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("live_scan_usage").insert({
          user_id: user.id,
          month_year: currentMonth,
          scan_count: 1,
          items_identified: itemsIdentified,
        });
      }

      // Update local state
      setStatus(prev => ({
        ...prev,
        scansUsed: prev.scansUsed + 1,
      }));
    } catch (error) {
      console.error("Failed to increment scan usage:", error);
    }
  }, [user]);

  return {
    ...status,
    checkSubscription,
    canUseLiveScanner,
    getRemainingScans,
    incrementScanUsage,
  };
}

// Constants for item limits
export const MAX_ITEMS_PER_SCAN = 30;
