import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Camera,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Zap,
  Package,
  FileSpreadsheet,
  Crown,
  Sun,
  Moon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function ThemeToggle({ dark, toggle }: { dark: boolean; toggle: () => void }) {
  return (
    <button
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
    >
      <AnimatePresence mode="wait" initial={false}>
        {dark ? (
          <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
            <Sun className="h-4 w-4" />
          </motion.div>
        ) : (
          <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
            <Moon className="h-4 w-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

export function Header() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('ispy-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const toggleTheme = () => setDark(!dark);

  const isActive = (path: string) => location.pathname === path;

  const navLinks = user ? [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/scan', label: 'Scan', icon: Camera },
    { path: '/inventory', label: 'Inventory', icon: Package },
    { path: '/listings', label: 'Listings', icon: FileSpreadsheet },
    { path: '/membership', label: 'Pro', icon: Crown },
  ] : [];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group" aria-label="Ispy.ai Home">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden shadow-md group-hover:shadow-glow transition-shadow duration-300 relative">
            <img
              src={dark ? "/logo-dark.png" : "/logo.png"}
              alt="Ispy.ai"
              className="h-9 w-9 object-cover rounded-xl transition-all duration-300"
              onError={(e) => {
                const target = e.currentTarget;
                // Prevent infinite loop if fallback fails
                target.onerror = null;
                if (target.src.includes('logo-dark.png')) {
                  target.src = '/logo.png';
                } else {
                  target.style.display = 'none';
                }
              }}
            />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">
            Ispy<span className="gradient-text">.ai</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              aria-current={isActive(link.path) ? 'page' : undefined}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive(link.path)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
              {isActive(link.path) && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-lg bg-primary/10"
                  style={{ zIndex: -1 }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              )}
            </Link>
          ))}
        </nav>

        {/* Desktop Auth + Theme Toggle */}
        <div className="hidden md:flex items-center gap-2">
          <ThemeToggle dark={dark} toggle={toggleTheme} />
          {user ? (
            <>
              <span className="text-sm text-muted-foreground truncate max-w-[160px]">
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Log In</Button>
              </Link>
              <Link to="/signup">
                <Button variant="hero" size="sm">
                  <Zap className="h-4 w-4" />
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile: theme + menu */}
        <div className="md:hidden flex items-center gap-1">
          <ThemeToggle dark={dark} toggle={toggleTheme} />
          <motion.button
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            whileTap={{ scale: 0.92 }}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="h-5 w-5" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Menu className="h-5 w-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="md:hidden overflow-hidden border-t border-border/50 bg-background/98 backdrop-blur-xl"
          >
            <nav className="container mx-auto px-4 py-4 space-y-1" aria-label="Mobile navigation">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.path}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={isActive(link.path) ? 'page' : undefined}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive(link.path)
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                  >
                    <link.icon className="h-5 w-5" />
                    {link.label}
                    {isActive(link.path) && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: navLinks.length * 0.04 }}
                className="border-t border-border/50 pt-3 mt-3 space-y-2"
              >
                {user ? (
                  <>
                    <p className="px-4 py-1 text-sm text-muted-foreground truncate">{user.email}</p>
                    <button
                      onClick={() => {
                        signOut();
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                    >
                      <LogOut className="h-5 w-5" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                    >
                      Log In
                    </Link>
                    <Link
                      to="/signup"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button variant="hero" className="w-full">
                        <Zap className="h-4 w-4" />
                        Get Started
                      </Button>
                    </Link>
                  </>
                )}
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
