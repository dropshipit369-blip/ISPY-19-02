import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

import { PageTransition } from "@/components/PageTransition";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-md">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="relative w-48 h-48 mx-auto">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
              <img src="/mascot.png" alt="Ispy Owl Mascot" className="relative w-full h-full object-contain filter drop-shadow-2xl animate-float" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-8xl font-bold font-display bg-gradient-to-r from-primary to-info bg-clip-text text-transparent mb-4">
              404
            </div>
            <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
            <p className="text-muted-foreground mb-8">
              Hmm, we can't seem to find this page. It might have moved or doesn't exist.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/">
                <Button variant="hero" size="lg">
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </Link>
              <Button variant="outline" size="lg" onClick={() => window.history.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </PageTransition >
  );
};

export default NotFound;
