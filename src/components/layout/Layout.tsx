import { Header } from './Header';
import { FloatingMascot } from '@/components/FloatingMascot';

export interface LayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
}

export function Layout({ children, showHeader = true }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-hero">
      {showHeader && <Header />}
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border/50 bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Ispy.ai. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
      <FloatingMascot />
    </div>
  );
}
