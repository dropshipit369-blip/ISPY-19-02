import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Zap,
  Crown,
  Sparkles,
  Loader2,
  ExternalLink,
  Shield,
  Eye,
  Package,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { invokeSupabaseFunction, parseSupabaseFunctionError } from "@/lib/supabase-functions";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "A$0",
    period: "forever",
    description: "Basic features for getting started",
    features: [
      "5 Live Scans per month",
      "Single item scans",
      "Lot uploads",
      "Barcode scanning",
      "Basic market reports",
      "Inventory management",
    ],
    limitations: [],
    icon: Package,
    gradient: "from-muted/50 to-muted/30",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "A$19",
    period: "/month",
    description: "Perfect for serious resellers",
    features: [
      "Everything in Free",
      "50 Live Scans per month",
      "Up to 30 items per scan",
      "Priority AI processing",
      "Advanced market insights",
    ],
    limitations: [],
    icon: Zap,
    gradient: "from-primary/20 to-info/20",
    popular: true,
  },
  {
    id: "unlimited",
    name: "Unlimited",
    price: "A$49",
    period: "/month",
    description: "For power users and dealers",
    features: [
      "Everything in Pro",
      "Unlimited Live Scans",
      "Up to 30 items per scan",
      "Bulk export features",
      "Priority support",
    ],
    limitations: [],
    icon: Crown,
    gradient: "from-warning/20 to-success/20",
    popular: false,
  },
];

export default function Membership() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { planType, subscribed, scansUsed, scansLimit, loading, checkSubscription } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Welcome to your new plan! Your membership is now active.");
      checkSubscription();
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Checkout was canceled. No charges were made.");
    }
  }, [searchParams, checkSubscription]);

  const handleCheckout = async (selectedPlan: string) => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (selectedPlan === "free") return;

    setCheckoutLoading(selectedPlan);
    try {
      const { data, error } = await invokeSupabaseFunction<{ url?: string }>("create-checkout", {
        body: { planType: selectedPlan },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: unknown) {
      console.error("Checkout error:", error);
      toast.error(await parseSupabaseFunctionError(error, "Failed to start checkout"));
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await invokeSupabaseFunction<{ url?: string }>("customer-portal");

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: unknown) {
      console.error("Portal error:", error);
      toast.error(await parseSupabaseFunctionError(error, "Failed to open subscription portal"));
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <Layout>
      <PageTransition>
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background via-background to-muted/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Crown className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Membership Plans</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">
              Unlock <span className="gradient-text">Live Scanning</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your reselling needs. Upgrade anytime to access real-time AI-powered item detection.
            </p>
          </motion.div>

          {/* Current Plan Status */}
          {user && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <Card className="bg-gradient-to-r from-primary/10 via-info/10 to-success/10 border-primary/20">
                <CardContent className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/20">
                      {planType === "unlimited" ? (
                        <Crown className="w-6 h-6 text-primary" />
                      ) : planType === "pro" ? (
                        <Zap className="w-6 h-6 text-primary" />
                      ) : (
                        <Package className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Plan</p>
                      <p className="text-xl font-bold capitalize">{planType}</p>
                      {(planType === "pro" || planType === "free") && scansLimit > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {scansUsed} / {scansLimit} live scans used this month
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkSubscription()}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                    {subscribed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManageSubscription}
                        disabled={portalLoading}
                      >
                        {portalLoading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ExternalLink className="w-4 h-4 mr-2" />
                        )}
                        Manage Subscription
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, index) => {
              const isCurrentPlan = planType === plan.id;
              const Icon = plan.icon;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                >
                  <Card 
                    className={`relative h-full flex flex-col border-2 transition-all ${
                      isCurrentPlan 
                        ? "border-primary shadow-lg shadow-primary/10" 
                        : plan.popular 
                          ? "border-primary/50" 
                          : "border-border/50 hover:border-primary/30"
                    }`}
                  >
                    {plan.popular && !isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                      </div>
                    )}
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-success text-primary-foreground">Your Plan</Badge>
                      </div>
                    )}

                    <CardHeader className={`bg-gradient-to-br ${plan.gradient} rounded-t-lg`}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-background/80">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">{plan.price}</span>
                        <span className="text-muted-foreground">{plan.period}</span>
                      </div>
                      <CardDescription className="mt-2">{plan.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="flex-1 pt-6">
                      <ul className="space-y-3">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                        {plan.limitations.map((limitation, i) => (
                          <li key={i} className="flex items-start gap-3 text-muted-foreground">
                            <Shield className="w-5 h-5 shrink-0 mt-0.5" />
                            <span className="text-sm">{limitation}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>

                    <div className="p-6 pt-0 mt-auto">
                      {isCurrentPlan ? (
                        <Button className="w-full" variant="outline" disabled>
                          <Check className="w-4 h-4 mr-2" />
                          Current Plan
                        </Button>
                      ) : plan.id === "free" ? (
                        <Button className="w-full" variant="outline" disabled>
                          Free Forever
                        </Button>
                      ) : (
                        <Button
                          className={`w-full ${plan.popular ? "bg-gradient-to-r from-primary to-info" : ""}`}
                          onClick={() => handleCheckout(plan.id)}
                          disabled={checkoutLoading === plan.id}
                        >
                          {checkoutLoading === plan.id ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                          ) : (
                            <><Sparkles className="w-4 h-4 mr-2" /> Upgrade to {plan.name}</>
                          )}
                        </Button>
                      )}
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Features Comparison */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-16"
          >
            <Card className="bg-muted/30">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  Live Scanning Feature
                </CardTitle>
                <CardDescription>
                  Point your camera at items and get instant AI-powered identification and pricing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-background/50 rounded-xl p-4 text-center">
                    <Zap className="w-8 h-8 text-primary mx-auto mb-2" />
                    <h4 className="font-semibold mb-1">Real-time Detection</h4>
                    <p className="text-sm text-muted-foreground">
                      Identify items instantly as you scan
                    </p>
                  </div>
                  <div className="bg-background/50 rounded-xl p-4 text-center">
                    <TrendingUp className="w-8 h-8 text-success mx-auto mb-2" />
                    <h4 className="font-semibold mb-1">Live Pricing</h4>
                    <p className="text-sm text-muted-foreground">
                      Get market values on the spot
                    </p>
                  </div>
                  <div className="bg-background/50 rounded-xl p-4 text-center">
                    <Package className="w-8 h-8 text-info mx-auto mb-2" />
                    <h4 className="font-semibold mb-1">30 Items per Scan</h4>
                    <p className="text-sm text-muted-foreground">
                      Process multiple items in one session
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
      </PageTransition>
    </Layout>
  );
}
