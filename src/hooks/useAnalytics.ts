/**
 * Application Name: iSpy Profit Tool
 * Application ID: ispy-profit-tool
 * Application Version: 1.0.0
 * Application Owner: AI System Specialist
 * Application Contact: admin@ispy.com
 */
import posthog from 'posthog-js';
import { useEffect } from 'react';
import { useAuth } from './useAuth';

export const useAnalytics = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (user) posthog.identify(user.id, { email: user.email });
    else posthog.reset();
  }, [user]);

  return {
    trackScan: (itemName: string, cached: boolean) => posthog.capture('scan_completed', { item: itemName, cached }),
    trackPaywall: (feature: string) => posthog.capture('paywall_viewed', { gated_feature: feature }),
    trackSubscription: (tier: string) => posthog.capture('subscription_started', { tier, revenue_impact: true })
  };
};
