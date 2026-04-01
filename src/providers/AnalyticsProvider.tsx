/**
 * Application Name: iSpy Profit Tool
 * Application ID: ispy-profit-tool
 * Application Version: 1.0.0
 * Application Owner: AI System Specialist
 * Application Contact: admin@ispy.com
 */
import React, { useEffect } from 'react';
import posthog from 'posthog-js';

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
      autocapture: false,
    });
  }, []);
  return <>{children}</>;
};
