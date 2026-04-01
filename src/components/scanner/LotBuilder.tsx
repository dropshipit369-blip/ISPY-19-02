import { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Layers,
  Plus,
  X,
  Check,
  GripVertical,
  Wand2,
  Package,
  DollarSign,
  AlertTriangle,
  Trash2,
  Edit2,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Lot, LotItem } from '@/hooks/useLotManager';
import { formatAud } from '@/lib/utils';

/* ───────────────── TYPES ───────────────── */

interface LotBuilderProps {
  open: boolean;
  onClose: () => void;
  items: LotItem[];
  lots: Lot[];
  selectedItems: Set<string>;
  onCreateLot: (itemKeys: string[], name?: string) => Lot | null;
  onUpdateLot: (lotId: string, updates: Partial<Pick<Lot, 'name' | 'items'>>) => void;
  onDeleteLot: (lotId: string) => void;
  onAddItemsToLot: (lotId: string, itemKeys: string[]) => void;
  onRemoveItemsFromLot: (lotId: string, itemKeys: string[]) => void;
  onToggleItem: (itemKey: string) => void;
  onClearSelection: () => void;
  onAutoGroupByCategory: () => void;
  onAutoGroupByCondition: () => void;
}

/* ───────────────── SUB-COMPONENTS ───────────────── */

function DraggableItem({
  item,
  isSelected,
  lotName,
  onToggle,
}: {
  item: LotItem;
  isSelected: boolean;
  lotName?: string;
  onToggle: () => void;
}) {
  return (
    <Reorder.Item
      value={item.key}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all',
        isSelected
          ? 'bg-primary/10 border-primary/50'
          : 'bg-card border-border/50 hover:border-border',
        lotName && 'opacity-60'
      )}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      
      <div
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0',
          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30 hover:border-muted-foreground'
        )}
      >
        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatAud(item.price)}
          {item.category && <span className="ml-2">• {item.category}</span>}
          {lotName && <span className="ml-2 text-primary">• {lotName}</span>}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className={cn(
          'text-xs font-semibold',
          item.netProfitLow > 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          {formatAud(item.netProfitLow, { showPlus: true })}
        </p>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px]',
            item.confidence >= 70
              ? 'border-emerald-500/30 text-emerald-400'
              : item.confidence >= 50
              ? 'border-amber-500/30 text-amber-400'
              : 'border-red-500/30 text-red-400'
          )}
        >
          {item.confidence}%
        </Badge>
      </div>
    </Reorder.Item>
  );
}

function LotPreview({
  lot,
  items,
  isEditing,
  editName,
  onEditNameChange,
  onStartEdit,
  onSaveEdit,
  onDelete,
  onAddItems,
  onRemoveItem,
}: {
  lot: Lot;
  items: LotItem[];
  isEditing: boolean;
  editName: string;
  onEditNameChange: (name: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onAddItems: () => void;
  onRemoveItem: (key: string) => void;
}) {
  const lotItems = items.filter(item => lot.items.includes(item.key));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-gradient-to-b from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onSaveEdit}>
              <Save className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span className="font-semibold">{lot.name}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onStartEdit}>
              <Edit2 className="w-3 h-3" />
            </Button>
          </div>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
        <div className="p-2 rounded-lg bg-background/50">
          <p className="text-muted-foreground">Items</p>
          <p className="font-bold">{lot.items.length}</p>
        </div>
        <div className="p-2 rounded-lg bg-background/50">
          <p className="text-muted-foreground">Value</p>
          <p className="font-bold">{formatAud(lot.recommendedLotPrice)}</p>
        </div>
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <p className="text-muted-foreground">Profit</p>
          <p className="font-bold text-emerald-400">{formatAud(lot.projectedProfit.low, { showPlus: true })}</p>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1.5 mb-3">
        {lotItems.map(item => (
          <div
            key={item.key}
            className="flex items-center justify-between p-2 rounded-lg bg-background/50 group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{item.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatAud(item.price)} ({Math.round((item.price / lot.combinedValue) * 100)}%)
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemoveItem(item.key)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add Items */}
      <Button
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={onAddItems}
      >
        <Plus className="w-3 h-3 mr-2" />
        Add Items
      </Button>
    </motion.div>
  );
}

/* ───────────────── MAIN COMPONENT ───────────────── */

export function LotBuilder({
  open,
  onClose,
  items,
  lots,
  selectedItems,
  onCreateLot,
  onUpdateLot,
  onDeleteLot,
  onAddItemsToLot,
  onRemoveItemsFromLot,
  onToggleItem,
  onClearSelection,
  onAutoGroupByCategory,
  onAutoGroupByCondition,
}: LotBuilderProps) {
  const [editingLot, setEditingLot] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [addingToLot, setAddingToLot] = useState<string | null>(null);
  const [newLotName, setNewLotName] = useState('');
  const [itemOrder, setItemOrder] = useState<string[]>([]);

  // Initialize item order
  useState(() => {
    setItemOrder(items.map(i => i.key));
  });

  // Get lot by item key
  const getLotByItemKey = (key: string) => lots.find(lot => lot.items.includes(key));

  // Handle create lot
  const handleCreateLot = () => {
    if (selectedItems.size < 2) return;
    onCreateLot(Array.from(selectedItems), newLotName || undefined);
    setNewLotName('');
  };

  // Handle start edit
  const handleStartEdit = (lot: Lot) => {
    setEditingLot(lot.id);
    setEditName(lot.name);
  };

  // Handle save edit
  const handleSaveEdit = (lotId: string) => {
    if (editName.trim()) {
      onUpdateLot(lotId, { name: editName.trim() });
    }
    setEditingLot(null);
    setEditName('');
  };

  // Handle add items to lot
  const handleAddItemsToLot = (lotId: string) => {
    if (selectedItems.size === 0) {
      setAddingToLot(lotId);
      return;
    }
    onAddItemsToLot(lotId, Array.from(selectedItems));
    onClearSelection();
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Lot Builder
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onAutoGroupByCategory}
              className="flex-1"
            >
              <Wand2 className="w-3 h-3 mr-2" />
              Auto by Category
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onAutoGroupByCondition}
              className="flex-1"
            >
              <Wand2 className="w-3 h-3 mr-2" />
              Auto by Condition
            </Button>
          </div>

          {/* Selection Panel */}
          {selectedItems.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-primary/10 border border-primary/30 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">
                  {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                </span>
                <Button variant="ghost" size="sm" onClick={onClearSelection}>
                  Clear
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Lot name (optional)"
                  value={newLotName}
                  onChange={(e) => setNewLotName(e.target.value)}
                  className="flex-1 h-9"
                />
                <Button
                  onClick={handleCreateLot}
                  disabled={selectedItems.size < 2}
                  size="sm"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Create Lot
                </Button>
              </div>
            </motion.div>
          )}

          {/* Existing Lots */}
          {lots.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Your Lots ({lots.length})</h3>
              <AnimatePresence>
                {lots.map(lot => (
                  <LotPreview
                    key={lot.id}
                    lot={lot}
                    items={items}
                    isEditing={editingLot === lot.id}
                    editName={editName}
                    onEditNameChange={setEditName}
                    onStartEdit={() => handleStartEdit(lot)}
                    onSaveEdit={() => handleSaveEdit(lot.id)}
                    onDelete={() => onDeleteLot(lot.id)}
                    onAddItems={() => handleAddItemsToLot(lot.id)}
                    onRemoveItem={(key) => onRemoveItemsFromLot(lot.id, [key])}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Available Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                Items ({items.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Drag to reorder • Click to select
              </p>
            </div>

            <Reorder.Group
              axis="y"
              values={itemOrder}
              onReorder={setItemOrder}
              className="space-y-2"
            >
              {items
                .sort((a, b) => itemOrder.indexOf(a.key) - itemOrder.indexOf(b.key))
                .map(item => (
                  <DraggableItem
                    key={item.key}
                    item={item}
                    isSelected={selectedItems.has(item.key)}
                    lotName={getLotByItemKey(item.key)?.name}
                    onToggle={() => onToggleItem(item.key)}
                  />
                ))}
            </Reorder.Group>
          </div>

          {/* Empty State */}
          {items.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No items available</p>
              <p className="text-sm text-muted-foreground/70">
                Scan items to start building lots
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50">
          <Button variant="default" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
