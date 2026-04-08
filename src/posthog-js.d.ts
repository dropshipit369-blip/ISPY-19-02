declare module 'posthog-js' {
  interface PostHog {
    init(token: string, options?: Record<string, unknown>): void;
    identify(id: string, properties?: Record<string, unknown>): void;
    reset(): void;
    capture(event: string, properties?: Record<string, unknown>): void;
  }
  const posthog: PostHog;
  export default posthog;
}
