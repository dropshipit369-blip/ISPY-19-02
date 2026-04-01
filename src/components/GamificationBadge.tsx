import { motion } from "framer-motion";
import {
  Flame,
  Target,
  Trophy,
  Star,
  Zap,
  Crown,
  TrendingUp,
  Eye
} from "lucide-react";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: "flame" | "target" | "trophy" | "star" | "zap" | "crown" | "trending" | "eye";
  progress: number;
  total: number;
  unlocked: boolean;
  rarity: "common" | "rare" | "epic" | "legendary";
}

const iconMap = {
  flame: Flame,
  target: Target,
  trophy: Trophy,
  star: Star,
  zap: Zap,
  crown: Crown,
  trending: TrendingUp,
  eye: Eye,
};

const rarityColors = {
  common: { bg: "from-slate-500/20 to-slate-600/20", border: "border-slate-500/30", text: "text-slate-400" },
  rare: { bg: "from-blue-500/20 to-cyan-500/20", border: "border-blue-500/30", text: "text-blue-400" },
  epic: { bg: "from-purple-500/20 to-pink-500/20", border: "border-purple-500/30", text: "text-purple-400" },
  legendary: { bg: "from-amber-500/20 to-orange-500/20", border: "border-amber-500/30", text: "text-amber-400" },
};

interface GamificationBadgeProps {
  achievement: Achievement;
  compact?: boolean;
}

export function GamificationBadge({ achievement, compact = false }: GamificationBadgeProps) {
  const Icon = iconMap[achievement.icon];
  const colors = rarityColors[achievement.rarity];
  const progressPercent = Math.min((achievement.progress / achievement.total) * 100, 100);

  if (compact) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        className={`relative flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r ${colors.bg} border ${colors.border} ${!achievement.unlocked ? "opacity-50 grayscale" : ""}`}
      >
        <Icon className={`w-4 h-4 ${colors.text}`} />
        <span className="text-xs font-medium">{achievement.title}</span>
        {achievement.unlocked && achievement.rarity === "legendary" && (
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,193,7,0.1), transparent)",
              backgroundSize: "200% 100%",
            }}
            animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={`relative p-4 rounded-2xl bg-gradient-to-br ${colors.bg} border ${colors.border} ${!achievement.unlocked ? "opacity-60 grayscale" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl bg-background/50 ${colors.text}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{achievement.title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{achievement.description}</p>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-background/50 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${colors.bg.replace("/20", "/60")}`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {achievement.progress}/{achievement.total}
          </p>
        </div>
      </div>

      {/* Shimmer for legendary */}
      {achievement.unlocked && achievement.rarity === "legendary" && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,193,7,0.08), transparent)",
            backgroundSize: "200% 100%",
          }}
          animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

// Streak display component
interface StreakDisplayProps {
  count: number;
  label?: string;
}

export function StreakDisplay({ count, label = "Day Streak" }: StreakDisplayProps) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30"
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <Flame className="w-5 h-5 text-orange-400" />
      </motion.div>
      <div>
        <span className="text-lg font-bold text-orange-400">{count}</span>
        <span className="text-xs text-muted-foreground ml-1">{label}</span>
      </div>
    </motion.div>
  );
}

// Helper to generate sample achievements based on user stats
export function generateAchievements(stats: {
  totalScans: number;
  totalItems: number;
  totalSold: number;
  totalProfit: number;
  daysActive: number;
  currentStreak: number;
}): Achievement[] {
  return [
    {
      id: "first-scan",
      title: "First Scan",
      description: "Complete your first item scan",
      icon: "eye",
      progress: Math.min(stats.totalScans, 1),
      total: 1,
      unlocked: stats.totalScans >= 1,
      rarity: "common",
    },
    {
      id: "scanner-10",
      title: "Sharp Eye",
      description: "Scan 10 items",
      icon: "target",
      progress: Math.min(stats.totalScans, 10),
      total: 10,
      unlocked: stats.totalScans >= 10,
      rarity: "common",
    },
    {
      id: "scanner-50",
      title: "Deal Hunter",
      description: "Scan 50 items",
      icon: "zap",
      progress: Math.min(stats.totalScans, 50),
      total: 50,
      unlocked: stats.totalScans >= 50,
      rarity: "rare",
    },
    {
      id: "scanner-200",
      title: "Market Expert",
      description: "Scan 200 items",
      icon: "crown",
      progress: Math.min(stats.totalScans, 200),
      total: 200,
      unlocked: stats.totalScans >= 200,
      rarity: "epic",
    },
    {
      id: "inventory-25",
      title: "Shelf Builder",
      description: "Save 25 items to inventory",
      icon: "target",
      progress: Math.min(stats.totalItems, 25),
      total: 25,
      unlocked: stats.totalItems >= 25,
      rarity: "common",
    },
    {
      id: "inventory-100",
      title: "Warehouse Mode",
      description: "Save 100 items to inventory",
      icon: "crown",
      progress: Math.min(stats.totalItems, 100),
      total: 100,
      unlocked: stats.totalItems >= 100,
      rarity: "rare",
    },
    {
      id: "first-sale",
      title: "First Sale",
      description: "Mark your first item as sold",
      icon: "star",
      progress: Math.min(stats.totalSold, 1),
      total: 1,
      unlocked: stats.totalSold >= 1,
      rarity: "common",
    },
    {
      id: "sales-10",
      title: "Repeat Seller",
      description: "Sell 10 items",
      icon: "zap",
      progress: Math.min(stats.totalSold, 10),
      total: 10,
      unlocked: stats.totalSold >= 10,
      rarity: "rare",
    },
    {
      id: "profit-100",
      title: "Triple Digits",
      description: "Earn A$100 in total profit",
      icon: "trending",
      progress: Math.min(Math.round(stats.totalProfit), 100),
      total: 100,
      unlocked: stats.totalProfit >= 100,
      rarity: "rare",
    },
    {
      id: "profit-1000",
      title: "Profit Machine",
      description: "Earn A$1,000 in total profit",
      icon: "trophy",
      progress: Math.min(Math.round(stats.totalProfit), 1000),
      total: 1000,
      unlocked: stats.totalProfit >= 1000,
      rarity: "epic",
    },
    {
      id: "profit-10000",
      title: "Resale Legend",
      description: "Earn A$10,000 in total profit",
      icon: "crown",
      progress: Math.min(Math.round(stats.totalProfit), 10000),
      total: 10000,
      unlocked: stats.totalProfit >= 10000,
      rarity: "legendary",
    },
    {
      id: "active-7",
      title: "Weekly Grinder",
      description: "Stay active for 7 scan days",
      icon: "flame",
      progress: Math.min(stats.daysActive, 7),
      total: 7,
      unlocked: stats.daysActive >= 7,
      rarity: "common",
    },
    {
      id: "active-30",
      title: "Monthly Momentum",
      description: "Reach 30 active scan days",
      icon: "flame",
      progress: Math.min(stats.daysActive, 30),
      total: 30,
      unlocked: stats.daysActive >= 30,
      rarity: "epic",
    },
    {
      id: "streak-3",
      title: "Heating Up",
      description: "Hit a 3-day streak",
      icon: "flame",
      progress: Math.min(stats.currentStreak, 3),
      total: 3,
      unlocked: stats.currentStreak >= 3,
      rarity: "common",
    },
    {
      id: "streak-14",
      title: "On Fire",
      description: "Hit a 14-day streak",
      icon: "trophy",
      progress: Math.min(stats.currentStreak, 14),
      total: 14,
      unlocked: stats.currentStreak >= 14,
      rarity: "legendary",
    },
  ];
}
