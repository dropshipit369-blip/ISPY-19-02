import { motion } from 'framer-motion';
import {
  Gamepad2,
  Shirt,
  Laptop,
  Package,
  Medal,
  BookOpen,
  Home,
  Hammer,
  ShoppingBag,
  X,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ScanIntent =
  | 'toys-collectables'
  | 'clothing-vintage'
  | 'shoes'
  | 'electronics'
  | 'bulk-mixed'
  | 'military-medals'
  | 'books-media'
  | 'home-decor'
  | 'handmade-art';

interface IntentOption {
  id: ScanIntent;
  label: string;
  description: string;
  icon: typeof Gamepad2;
  gradient: string;
  examples: string[];
}

const intentOptions: IntentOption[] = [
  {
    id: 'toys-collectables',
    label: 'Toys & Collectables',
    description: 'Action figures, LEGO, vintage toys',
    icon: Gamepad2,
    gradient: 'from-amber-500/20 to-orange-500/20',
    examples: ['Hot Wheels', 'Funko Pop', 'Star Wars']
  },
  {
    id: 'clothing-vintage',
    label: 'Clothing & Vintage',
    description: 'Designer, vintage, streetwear',
    icon: Shirt,
    gradient: 'from-pink-500/20 to-rose-500/20',
    examples: ['Nike', 'Vintage Levi\'s', 'Band tees']
  },
  {
    id: 'shoes',
    label: 'Shoes & Sneakers',
    description: 'Sneakers, boots, designer footwear',
    icon: ShoppingBag,
    gradient: 'from-orange-500/20 to-red-500/20',
    examples: ['Air Jordans', 'Yeezys', 'Timberlands']
  },
  {
    id: 'electronics',
    label: 'Electronics',
    description: 'Phones, consoles, audio gear',
    icon: Laptop,
    gradient: 'from-blue-500/20 to-cyan-500/20',
    examples: ['iPhone', 'PS5', 'AirPods']
  },
  {
    id: 'bulk-mixed',
    label: 'Bulk / Mixed Lot',
    description: 'Multiple items, estate sale finds',
    icon: Package,
    gradient: 'from-emerald-500/20 to-teal-500/20',
    examples: ['Grab bags', 'Estate lots', 'Bulk buys']
  },
  {
    id: 'military-medals',
    label: 'Military & Medals',
    description: 'Militaria, medals, historical items',
    icon: Medal,
    gradient: 'from-slate-500/20 to-zinc-500/20',
    examples: ['WWII items', 'Badges', 'Uniforms']
  },
  {
    id: 'books-media',
    label: 'Books & Media',
    description: 'First editions, vinyl, games',
    icon: BookOpen,
    gradient: 'from-purple-500/20 to-violet-500/20',
    examples: ['First editions', 'Vinyl records', 'Rare games']
  },
  {
    id: 'home-decor',
    label: 'Home Decor',
    description: 'Homewares, furniture, decorative pieces',
    icon: Home,
    gradient: 'from-lime-500/20 to-green-500/20',
    examples: ['Vintage lamps', 'Ceramics', 'Wall art']
  },
  {
    id: 'handmade-art',
    label: 'Handmade & Art',
    description: 'Sculptures, carvings, paintings, craft',
    icon: Hammer,
    gradient: 'from-rose-500/20 to-fuchsia-500/20',
    examples: ['Wood carvings', 'Oil paintings', 'Pottery']
  }
];

interface IntentSelectorProps {
  onSelect: (intent: ScanIntent) => void;
  onSkip: () => void;
}

export function IntentSelector({ onSelect, onSkip }: IntentSelectorProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-semibold text-lg">Pick category to focus</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Subtitle */}
      <div className="px-4 py-3 text-center">
        <p className="text-muted-foreground text-sm">
          This helps narrow AI recognition and improve pricing accuracy
        </p>
      </div>

      {/* Intent Options Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-1 gap-3">
          {intentOptions.map((option, index) => (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelect(option.id)}
              className={`relative w-full p-4 rounded-2xl border border-border/50 bg-gradient-to-br ${option.gradient} backdrop-blur-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left active:scale-[0.98]`}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-background/80 shadow-sm shrink-0">
                  <option.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-base">{option.label}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{option.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {option.examples.map((ex) => (
                      <span 
                        key={ex} 
                        className="text-xs px-2 py-0.5 rounded-full bg-background/60 text-muted-foreground"
                      >
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Skip Button */}
      <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <Button 
          variant="ghost" 
          className="w-full text-muted-foreground"
          onClick={onSkip}
        >
          Skip — scan anything
        </Button>
      </div>
    </motion.div>
  );
}
