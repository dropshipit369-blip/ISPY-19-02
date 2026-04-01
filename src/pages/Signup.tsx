import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { PageTransition } from "@/components/PageTransition";
import { motion } from "framer-motion";
import { hasSupabaseConfig, missingSupabaseEnvVars } from "@/integrations/supabase/env";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!hasSupabaseConfig) {
        throw new Error(
          `Configuration error: Missing ${missingSupabaseEnvVars().join(", ")}. Visit /debug-auth for diagnostics.`
        );
      }

      console.log('🔐 Attempting signup for:', email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        console.error('❌ Auth error:', error);
        throw error;
      }

      // Create profile
      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          user_id: data.user.id,
          full_name: fullName,
        }, { onConflict: "user_id" });
        if (profileError) {
          console.warn("Profile upsert warning:", profileError.message);
        }
      }

      const emailConfirmed = Boolean(data.user?.email_confirmed_at);
      const hasSession = Boolean(data.session);

      console.log('✅ Signup successful', { emailConfirmed, hasSession });

      if (!emailConfirmed) {
        if (hasSession) {
          await supabase.auth.signOut();
        }
        toast.success("Account created. Check your inbox to confirm your email before signing in.");
        navigate(`/login?verify=1&email=${encodeURIComponent(email)}`);
        return;
      }

      toast.success("Account created! Welcome to Ispy.ai.");
      navigate("/dashboard");
    } catch (error: any) {
      console.error('Signup error details:', {
        message: error.message,
        name: error.name,
        status: error.status,
      });

      let errorMessage = error.message || "Failed to create account";

      // Provide helpful messages for common errors
      if (errorMessage.includes("Failed to fetch")) {
        errorMessage =
          "Cannot reach Supabase server. Check your internet connection and try again. " +
          "Visit /debug-auth for diagnostics.";
      } else if (errorMessage.includes("already registered")) {
        errorMessage = "This email is already registered. Try signing in instead.";
      } else if (errorMessage.includes("password")) {
        errorMessage = "Password must be at least 6 characters";
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
                    <img src="/mascot.png" alt="Ispy Owl Mascot" className="relative w-full h-full object-contain animate-float" />
                  </div>
                </motion.div>
                <h1 className="text-2xl font-bold">Create Account</h1>
                <p className="text-muted-foreground text-sm">Start analyzing items in minutes</p>
              </CardHeader>

              <CardContent className="pt-6">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

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
                        placeholder="Create a password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        minLength={6}
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                  </div>

                  <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating account...</>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm">
                  <span className="text-muted-foreground">Already have an account? </span>
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    Sign in
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
