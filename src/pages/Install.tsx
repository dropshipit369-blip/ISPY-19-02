import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Smartphone,
  CheckCircle2,
  WifiOff,
  Zap,
  Shield,
  Sparkles,
  ArrowRight,
  Share,
  PlusSquare,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  const features = [
    {
      icon: WifiOff,
      title: 'Works Offline',
      description: 'Scan and price items even without internet. Syncs when you reconnect.',
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Instant loading. No app store. Installs in seconds.',
    },
    {
      icon: Shield,
      title: 'Always Updated',
      description: 'Get the latest features automatically. No manual updates needed.',
    },
    {
      icon: Sparkles,
      title: 'Native Feel',
      description: 'Full-screen experience just like a native app.',
    },
  ];

  // Already running as installed app
  if (isStandalone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Already Installed!</h1>
          <p className="text-muted-foreground mb-6">
            You're running the full Ispy.ai experience. Happy scanning!
          </p>
          <Button onClick={() => navigate('/scan')}>
            Start Scanning
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="max-w-lg mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-6 shadow-lg shadow-primary/20">
            <img src="/ispy-logo.png" alt="Ispy.ai" className="w-20 h-20 object-cover" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Install Ispy.ai</h1>
          <p className="text-muted-foreground">
            Add to your home screen for the best experience
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 gap-3 mb-8"
        >
          {features.map((feature, index) => (
            <Card key={feature.title} className="border-border/50">
              <CardContent className="p-4">
                <feature.icon className="w-6 h-6 text-primary mb-2" />
                <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Install Button or Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {isInstalled ? (
            <div className="text-center p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Successfully Installed!</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Find Ispy.ai on your home screen
              </p>
              <Button onClick={() => navigate('/scan')}>
                Open App
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : deferredPrompt ? (
            <Button
              size="lg"
              className="w-full h-14 text-lg"
              onClick={handleInstall}
            >
              <Download className="w-5 h-5 mr-2" />
              Install App
            </Button>
          ) : isIOS ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-xl border border-border/50">
                <h3 className="font-semibold mb-3 text-center">Install on iPhone/iPad</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Share className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">1. Tap Share</p>
                      <p className="text-xs text-muted-foreground">
                        In Safari, tap the share icon at the bottom
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <PlusSquare className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">2. Add to Home Screen</p>
                      <p className="text-xs text-muted-foreground">
                        Scroll down and tap "Add to Home Screen"
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">3. Confirm</p>
                      <p className="text-xs text-muted-foreground">
                        Tap "Add" to install the app
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-xl border border-border/50">
                <h3 className="font-semibold mb-3 text-center">Install on Android</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <MoreHorizontal className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">1. Open Menu</p>
                      <p className="text-xs text-muted-foreground">
                        Tap the three dots in Chrome's menu
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Download className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">2. Install App</p>
                      <p className="text-xs text-muted-foreground">
                        Tap "Install app" or "Add to Home screen"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Skip Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-8"
        >
          <button
            onClick={() => navigate('/scan')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Continue in browser →
          </button>
        </motion.div>
      </div>
    </div>
  );
}
