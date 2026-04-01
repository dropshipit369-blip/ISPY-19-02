import { motion } from 'framer-motion';
import { Sparkles, Star, ThumbsUp, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StandardCondition } from '@/hooks/useRepricingEngine';

interface ConditionSelectorProps {
  condition: StandardCondition;
  onConditionChange: (condition: StandardCondition) => void;
}

const CONDITION_CONFIG: Record<StandardCondition, {
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  description: string;
  variant: 'success' | 'info' | 'default' | 'warning' | 'destructive';
}> = {
  'new': {
    label: 'New',
    shortLabel: 'NEW',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Sealed, unused, original packaging',
    variant: 'success',
  },
  'like-new': {
    label: 'Like New',
    shortLabel: 'LN',
    icon: <Star className="w-4 h-4" />,
    description: 'Mint condition, no visible wear',
    variant: 'success',
  },
  'very-good': {
    label: 'Very Good',
    shortLabel: 'VG',
    icon: <ThumbsUp className="w-4 h-4" />,
    description: 'Light wear, fully functional',
    variant: 'info',
  },
  'good': {
    label: 'Good',
    shortLabel: 'G',
    icon: <CheckCircle className="w-4 h-4" />,
    description: 'Normal wear, works perfectly',
    variant: 'default',
  },
  'acceptable': {
    label: 'Acceptable',
    shortLabel: 'ACC',
    icon: <AlertCircle className="w-4 h-4" />,
    description: 'Noticeable wear, functional',
    variant: 'warning',
  },
  'poor': {
    label: 'Poor',
    shortLabel: 'P',
    icon: <AlertTriangle className="w-4 h-4" />,
    description: 'Heavy wear, may need repair',
    variant: 'destructive',
  },
};

const variantStyles = {
  success: {
    active: 'bg-success/20 text-success border-success/50 ring-success/50',
    hover: 'hover:bg-success/10',
  },
  info: {
    active: 'bg-primary/20 text-primary border-primary/50 ring-primary/50',
    hover: 'hover:bg-primary/10',
  },
  default: {
    active: 'bg-muted text-foreground border-border ring-border',
    hover: 'hover:bg-muted/50',
  },
  warning: {
    active: 'bg-warning/20 text-warning border-warning/50 ring-warning/50',
    hover: 'hover:bg-warning/10',
  },
  destructive: {
    active: 'bg-destructive/20 text-destructive border-destructive/50 ring-destructive/50',
    hover: 'hover:bg-destructive/10',
  },
};

export function ConditionSelector({ condition, onConditionChange }: ConditionSelectorProps) {
  const conditions: StandardCondition[] = ['new', 'like-new', 'very-good', 'good', 'acceptable', 'poor'];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2 text-foreground">
        <Sparkles className="w-4 h-4 text-primary" />
        Condition Grade
      </h4>

      <div className="grid grid-cols-3 gap-2">
        {conditions.map((cond) => {
          const config = CONDITION_CONFIG[cond];
          const isActive = condition === cond;
          const styles = variantStyles[config.variant];

          return (
            <motion.button
              key={cond}
              whileTap={{ scale: 0.95 }}
              onClick={() => onConditionChange(cond)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 p-3 rounded-xl border transition-all duration-200",
                "text-xs font-medium",
                isActive ? styles.active : styles.hover,
                isActive ? 'border-2 ring-2 ring-offset-1 ring-offset-background' : 'border-border/50',
                !isActive && 'text-muted-foreground'
              )}
            >
              <motion.div
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {config.icon}
              </motion.div>
              <span className="font-semibold">{config.label}</span>
              {isActive && (
                <motion.div
                  layoutId="condition-indicator"
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-current"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Active Condition Description */}
      <motion.p
        key={condition}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center text-xs text-muted-foreground"
      >
        {CONDITION_CONFIG[condition].description}
      </motion.p>
    </div>
  );
}
