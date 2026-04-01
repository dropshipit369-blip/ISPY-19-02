import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Camera,
  TrendingUp,
  DollarSign,
  BarChart3,
  Zap,
  Shield,
  ArrowRight,
  Crown,
  Sparkles,
  Eye,
  Layers,
  CheckCircle2
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";

import { AnimatedCounter } from "@/components/AnimatedCounter";
import { motion, useInView } from "framer-motion";
import { useRef, CSSProperties } from "react";
import { PageTransition } from "@/components/PageTransition";
import { staggerContainer, staggerItem } from "@/lib/animations";

const features = [
  {
    icon: Camera,
    title: "AI Vision Analysis",
    description: "Snap a photo and our AI identifies brand, model, condition, and extracts text automatically.",
    gradient: "from-primary/20 to-info/20",
  },
  {
    icon: TrendingUp,
    title: "Live Market Data",
    description: "Real-time pricing from eBay, Etsy, Amazon, Poshmark, and more marketplaces.",
    gradient: "from-info/20 to-primary/20",
  },
  {
    icon: DollarSign,
    title: "Smart Pricing",
    description: "Get condition-adjusted values with low, median, and high price ranges.",
    gradient: "from-success/20 to-info/20",
  },
  {
    icon: Eye,
    title: "Live Scanner",
    description: "Point your camera and get real-time item detection with instant profit overlays.",
    gradient: "from-warning/20 to-success/20",
  },
  {
    icon: Layers,
    title: "Lot Analysis",
    description: "Scan multiple items at once. Bundle pricing and lot vs. individual strategy.",
    gradient: "from-purple-500/20 to-pink-500/20",
  },
  {
    icon: Shield,
    title: "Profit Tracking",
    description: "Track costs, sales, and ROI across your entire inventory with analytics.",
    gradient: "from-primary/20 to-success/20",
  }
];

// Stats reflect real, verifiable product capabilities — no fabricated metrics.
const stats = [
  { value: "3", label: "AI Models Working Together" },
  { value: "4", label: "Scan Modes" },
  { value: "2", label: "Live Marketplaces" },
  { value: "AUD", label: "Pricing Currency" }
];

const steps = [
  { number: "01", title: "Scan", description: "Point your camera or upload a photo of any item" },
  { number: "02", title: "Analyze", description: "AI identifies the item and pulls live market data" },
  { number: "03", title: "Profit", description: "Get optimal pricing, marketplace strategy, and list instantly" },
];

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  const featuresRef = useRef(null);
  const featuresInView = useInView(featuresRef, { once: true, margin: "-50px" });

  return (
    <Layout showHeader={false}>
      <PageTransition>
        <div className="min-h-screen">
          {/* Hero Section */}
          <section className="relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-info/10" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-info/20 rounded-full blur-3xl animate-pulse-glow delay-1000" />

            {/* Floating particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-primary/30"
                  style={{
                    left: `${15 + i * 15}%`,
                    top: `${20 + (i % 3) * 25}%`,
                  }}
                  animate={{
                    y: [0, -30, 0],
                    opacity: [0.2, 0.6, 0.2],
                  }}
                  transition={{
                    duration: 3 + i * 0.5,
                    repeat: Infinity,
                    delay: i * 0.4,
                  }}
                />
              ))}
            </div>

            {/* Navigation */}
            <motion.nav
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-glow flex-shrink-0 relative">
                  <img src="/logo.png" alt="Ispy.ai" className="w-10 h-10 object-cover absolute inset-0 transition-opacity duration-300 dark:opacity-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <img src="/logo-dark.png" alt="Ispy.ai" className="w-10 h-10 object-cover absolute inset-0 transition-opacity duration-300 opacity-0 dark:opacity-100" onError={(e) => { e.currentTarget.src = "/logo.png"; e.currentTarget.classList.remove("opacity-0", "dark:opacity-100"); }} />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Ispy<span className="text-foreground">.ai</span>
                </span>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="ghost" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button variant="hero" asChild>
                  <Link to="/signup">Get Started</Link>
                </Button>
              </div>
            </motion.nav>

            {/* Hero Content */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24">
              <div className="text-center max-w-4xl mx-auto">
                {/* Mascot */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="mb-6"
                >
                  <div className="relative w-48 h-48 sm:w-64 sm:h-64 mx-auto drop-shadow-2xl">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse-glow" />
                    <img
                      src="/mascot-transparent.png"
                      alt="Ispy Owl Mascot"
                      className="relative w-full h-full object-contain animate-float"
                      onError={(e) => {
                        e.currentTarget.src = "/mascot.png";
                        e.currentTarget.onerror = null;
                      }}
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary font-medium">AI-Powered Market Intelligence</span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
                >
                  Know What It's
                  <span className="block bg-gradient-to-r from-primary via-info to-primary bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-x">
                    Really Worth
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
                >
                  Snap a photo, get instant market analysis. Real-time pricing from verified sold listings on eBay and leading marketplaces,
                  AI condition grading, and smart sales strategies.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                  <Button variant="hero" size="xl" className="group shadow-glow-lg" asChild>
                    <Link to="/signup">
                      Start Scanning Free
                      <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button variant="glass" size="xl" asChild>
                    <Link to="/signup?plan=pro">
                      <Crown className="w-5 h-5 mr-2" />
                      Join Membership
                    </Link>
                  </Button>
                </motion.div>
              </div>

              {/* Stats with animated counters */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 max-w-4xl mx-auto"
              >
                {stats.map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 + i * 0.1 }}
                    className="text-center group"
                  >
                    <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-info bg-clip-text text-transparent">
                      <AnimatedCounter value={stat.value} duration={2.5} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* How it Works - 3 Steps */}
          <AnimatedSection>
            <section className="py-20 px-6">
              <div className="max-w-5xl mx-auto">
                <div className="text-center mb-14">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Three Steps to <span className="gradient-text">Profit</span>
                  </h2>
                  <p className="text-muted-foreground max-w-xl mx-auto">
                    From scan to sale in seconds. Our AI does the heavy lifting.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                  {steps.map((step, i) => (
                    <motion.div
                      key={step.number}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.15 }}
                      className="relative text-center group"
                    >
                      <div className="text-6xl font-bold text-primary/10 mb-3 font-display transition-colors group-hover:text-primary/20">
                        {step.number}
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      {i < steps.length - 1 && (
                        <div className="hidden md:block absolute top-8 right-0 translate-x-1/2 w-12 h-px bg-gradient-to-r from-primary/30 to-transparent" />
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          </AnimatedSection>

          {/* Features Section */}
          <section className="py-24 px-6 bg-secondary/30" ref={featuresRef}>
            <div className="max-w-7xl mx-auto">
              <AnimatedSection>
                <div className="text-center mb-16">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Everything You Need to
                    <span className="text-primary"> Maximize Profits</span>
                  </h2>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    From instant identification to optimized listings, we've got your reselling business covered.
                  </p>
                </div>
              </AnimatedSection>

              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate={featuresInView ? "animate" : "initial"}
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {features.map((feature, i) => (
                  <motion.div key={i} variants={staggerItem}>
                    <Card className={`group hover:border-primary/50 transition-all duration-300 hover:shadow-glow hover:-translate-y-1 bg-gradient-to-br ${feature.gradient} border-border/50`}>
                      <CardContent className="p-6">
                        <div className="w-12 h-12 rounded-xl bg-background/60 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-background/80 transition-all duration-300">
                          <feature.icon className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* Social Proof / Trust */}
          <AnimatedSection>
            <section className="py-20 px-6">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Trusted by <span className="gradient-text">Resellers</span>
                  </h2>
                </div>
                <div className="grid sm:grid-cols-3 gap-6">
                  {[
                    { label: "Live Connectors", value: "2", desc: "eBay Australia & 1stDibs — Completed/Sold listings only" },
                    { label: "Scan Types", value: "4", desc: "Photo, Live, Barcode, and Lot scanning" },
                    { label: "AI Models", value: "3", desc: "Vision, Pricing, and Strategy AI" },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="text-center p-6 rounded-2xl bg-card/50 border border-border/50"
                    >
                      <div className="text-4xl font-bold text-primary mb-1">{item.value}</div>
                      <div className="font-semibold mb-1">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          </AnimatedSection>

          {/* CTA Section */}
          <AnimatedSection>
            <section className="py-24 px-6">
              <div className="max-w-4xl mx-auto text-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-info/20 rounded-3xl blur-xl" />
                  <Card className="relative border-primary/20 bg-card/80 backdrop-blur-xl overflow-hidden">
                    {/* Animated border shimmer */}
                    <div className="absolute inset-0 rounded-[inherit] overflow-hidden">
                      <motion.div
                        className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                    <CardContent className="p-12">
                      <div className="relative w-32 h-32 mx-auto mb-6">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                        <img src="/logo.png" alt="Ispy.ai Logo" className="relative w-full h-full object-contain block drop-shadow-xl" />
                      </div>
                      <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Ready to Boost Your Resale Game?
                      </h2>
                      <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                        AI-powered market intelligence built for resellers. Start free — no credit card needed.
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        {/* CTA: navigates to signup/login flow */}
                        <Button variant="hero" size="xl" className="shadow-glow-lg group" asChild>
                          <Link to="/signup">
                            Get Started for Free
                            <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                          </Link>
                        </Button>
                      </div>
                      <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-success" /> Free tier</span>
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-success" /> No credit card</span>
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-success" /> 5 free scans/mo</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>
          </AnimatedSection>

          {/* Footer */}
          <footer className="py-8 px-6 border-t border-border/50">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                  <img src="/logo.png" alt="Ispy.ai" className="w-8 h-8 object-cover" />
                </div>
                <span className="font-semibold gradient-text">Ispy.ai</span>
              </div>
              <p className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} Ispy.ai. All rights reserved.
              </p>
            </div>
          </footer>
        </div>
      </PageTransition>
    </Layout>
  );
}
