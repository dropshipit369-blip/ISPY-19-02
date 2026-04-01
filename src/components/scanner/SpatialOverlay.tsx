import { motion, AnimatePresence } from 'framer-motion';
import { formatAud } from '@/lib/utils';

export const SpatialOverlay = ({ items, onSelect }: { items: any[], onSelect: (item: any) => void }) => (
  <div className="absolute inset-0 pointer-events-none">
    <AnimatePresence>
      {items.map((item) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="absolute pointer-events-auto cursor-pointer"
          style={{
            left: `${item.analysis.boundingBox.x * 100}%`,
            top: `${item.analysis.boundingBox.y * 100}%`,
            width: `${item.analysis.boundingBox.width * 100}%`,
          }}
          onClick={() => onSelect(item)}
        >
          <div className="bg-primary/20 backdrop-blur-md border border-primary rounded-full px-3 py-1 animate-float shadow-glow">
            <span className="text-primary font-bold text-sm">{formatAud(item.marketReport.median_price)}</span>
          </div>
          <div className="mt-2 border-2 border-primary/50 rounded-lg h-24 w-full animate-pulse-glow" />
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);
