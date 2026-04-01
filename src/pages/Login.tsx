import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Scan, Mail, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { PageTransition } from "@/components/PageTransition";
import { motion } from "framer-motion";
import { hasSupabaseConfig, missingSupabaseEnvVars } from "@/integrations/supabase/env";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [showVerificationHelp, setShowVerificationHelp] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const verifyMode = searchParams.get("verify") === "1";
    const prefilledEmail = searchParams.get("email");
    if (verifyMode) {
      setShowVerificationHelp(true);
    }
    if (prefilledEmail) {
      setEmail((prev) => prev || prefilledEmail);
    }
  }, [searchParams]);

  const handleResendVerification = async () => {
    if (!email.trim()) {
      toast.error("Enter your email first, then resend verification.");
      return;
    }

    setResendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) throw error;
      toast.success("Verification email sent. Check your inbox and spam folder.");
    } catch (error: any) {
      toast.error(error?.message || "Unable to resend verification email.");
    } finally {
      setResendingVerification(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!hasSupabaseConfig) {
        throw new Error(
          `Configuration error: Missing ${missingSupabaseEnvVars().join(", ")}. Visit /debug-auth for diagnostics.`
        );
      }

      console.log('🔐 Attempting login for:', email);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Auth error:', error);
        throw error;
      }

      console.log('✅ Login successful');
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error('Login error details:', {
        message: error.message,
        name: error.name,
        status: error.status,
      });

      let errorMessage = error.message || "Failed to sign in";

      // Provide helpful messages for common errors
      if (errorMessage.includes("Failed to fetch")) {
        errorMessage =
          "Cannot reach Supabase server. Check your internet connection and try again. " +
          "Visit /debug-auth for diagnostics.";
      } else if (errorMessage.includes("invalid login credentials")) {
        errorMessage = "Invalid email or password";
      } else if (errorMessage.includes("Email not confirmed")) {
        errorMessage = "Please verify your email before signing in";
        setShowVerificationHelp(true);
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-info/5" />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-info/10 rounded-full blur-3xl" />

        <div className="relative z-10 w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
              <CardHeader className="text-center pb-2">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex justify-center mb-2"
                >
                  <div className="relative w-28 h-28 drop-shadow-lg">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
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
                <h1 className="text-2xl font-bold">Welcome Back</h1>
                <p className="text-muted-foreground text-sm">Sign in to your Ispy.ai account</p>
              </CardHeader>

              <CardContent className="pt-6">
                {showVerificationHelp && (
                  <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="text-sm text-foreground mb-2">
                      Confirm your email to unlock scanning and edge features.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendVerification}
                      disabled={resendingVerification}
                      className="w-full"
                    >
                      {resendingVerification ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending verification...</>
                      ) : (
                        <>Resend verification email</>
                      )}
                    </Button>
                  </div>
                )}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...</>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm">
                  <span className="text-muted-foreground">Don't have an account? </span>
                  <Link to="/signup" className="text-primary hover:underline font-medium">
                    Sign up
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
