import { useState, useCallback, useMemo, useEffect } from 'react';

/* ───────────────── TYPES ───────────────── */

export interface LotItem {
  key: string;
  name: string;
  price: number;
  lowPrice: number;
  highPrice: number;
  confidence: number;
  category?: string;
  condition?: string;
  suggestedBuy: number;
  netProfitLow: number;
  netProfitHigh: number;
  isRisky: boolean;
}

export interface Lot {
  id: string;
  name: string;
  items: string[]; // item keys
  combinedValue: number;
  combinedLowValue: number;
  combinedHighValue: number;
  combinedRiskScore: number;
  recommendedLotPrice: number;
  totalCostBasis: number;
  projectedProfit: { low: number; high: number };
  expectedTimeToSell: 'fast' | 'medium' | 'slow';
  createdAt: Date;
}

export interface LotAnalytics {
  totalLots: number;
  totalLotValue: number;
  highestValueLot: Lot | null;
  lowestValueLot: Lot | null;
  averageLotValue: number;
  totalLotProfit: { low: number; high: number };
}

interface UseLotManagerProps {
  items: LotItem[];
  userId: string;
}

const SESSION_STORAGE_KEY = 'resale-intel-session';
const LOT_STORAGE_KEY = 'resale-intel-lots';

/* ───────────────── HOOK ───────────────── */

export function useLotManager({ items, userId }: UseLotManagerProps) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Load lots from storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${LOT_STORAGE_KEY}-${userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setLots(parsed.map((lot: any) => ({
          ...lot,
          createdAt: new Date(lot.createdAt),
        })));
      }
    } catch (err) {
      console.error('Failed to load lots from storage:', err);
    }
  }, [userId]);

  // Save lots to storage
  useEffect(() => {
    try {
      localStorage.setItem(`${LOT_STORAGE_KEY}-${userId}`, JSON.stringify(lots));
    } catch (err) {
      console.error('Failed to save lots to storage:', err);
    }
  }, [lots, userId]);

  // Calculate lot metrics
  const calculateLotMetrics = useCallback((itemKeys: string[]): Omit<Lot, 'id' | 'name' | 'items' | 'createdAt'> => {
    const lotItems = items.filter(item => itemKeys.includes(item.key));
    
    if (lotItems.length === 0) {
      return {
        combinedValue: 0,
        combinedLowValue: 0,
        combinedHighValue: 0,
        combinedRiskScore: 0,
        recommendedLotPrice: 0,
        totalCostBasis: 0,
        projectedProfit: { low: 0, high: 0 },
        expectedTimeToSell: 'slow',
      };
    }

    const combinedValue = lotItems.reduce((sum, item) => sum + item.price, 0);
    const combinedLowValue = lotItems.reduce((sum, item) => sum + item.lowPrice, 0);
    const combinedHighValue = lotItems.reduce((sum, item) => sum + item.highPrice, 0);
    const totalCostBasis = lotItems.reduce((sum, item) => sum + item.suggestedBuy, 0);
    
    // Weight risk by item value
    const weightedRisk = lotItems.reduce((sum, item) => {
      const itemWeight = item.price / combinedValue;
      const itemRisk = item.isRisky ? 0.8 : (100 - item.confidence) / 100;
      return sum + (itemRisk * itemWeight);
    }, 0);

    // Lot discount (bulk items typically sell for 10-20% less)
    const lotDiscount = lotItems.length > 5 ? 0.85 : lotItems.length > 2 ? 0.9 : 0.95;
    const recommendedLotPrice = Math.round(combinedValue * lotDiscount);

    // Calculate platform fees (13%)
    const platformFees = recommendedLotPrice * 0.13;
    
    // Project profit
    const profitLow = Math.round(combinedLowValue * lotDiscount - totalCostBasis - platformFees);
    const profitHigh = Math.round(combinedHighValue * lotDiscount - totalCostBasis - platformFees);

    // Time to sell based on lot size and risk
    const avgConfidence = lotItems.reduce((sum, item) => sum + item.confidence, 0) / lotItems.length;
    const expectedTimeToSell: 'fast' | 'medium' | 'slow' = 
      avgConfidence >= 80 && lotItems.length <= 3 ? 'fast' :
      avgConfidence >= 60 ? 'medium' : 'slow';

    return {
      combinedValue,
      combinedLowValue,
      combinedHighValue,
      combinedRiskScore: Math.round(weightedRisk * 100),
      recommendedLotPrice,
      totalCostBasis,
      projectedProfit: { low: profitLow, high: profitHigh },
      expectedTimeToSell,
    };
  }, [items]);

  // Create a new lot
  const createLot = useCallback((itemKeys: string[], name?: string) => {
    const metrics = calculateLotMetrics(itemKeys);
    const lot: Lot = {
      id: `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name || `Lot ${lots.length + 1}`,
      items: itemKeys,
      ...metrics,
      createdAt: new Date(),
    };
    
    setLots(prev => [...prev, lot]);
    setSelectedItems(new Set());
    return lot;
  }, [calculateLotMetrics, lots.length]);

  // Create lot from selection
  const createLotFromSelection = useCallback((name?: string) => {
    if (selectedItems.size < 2) return null;
    return createLot(Array.from(selectedItems), name);
  }, [createLot, selectedItems]);

  // Auto-group by category
  const autoGroupByCategory = useCallback(() => {
    const categoryGroups: Record<string, string[]> = {};
    
    items.forEach(item => {
      const category = item.category || 'Uncategorized';
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(item.key);
    });

    const newLots: Lot[] = [];
    Object.entries(categoryGroups).forEach(([category, keys]) => {
      if (keys.length >= 2) {
        const metrics = calculateLotMetrics(keys);
        newLots.push({
          id: `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `${category} Lot`,
          items: keys,
          ...metrics,
          createdAt: new Date(),
        });
      }
    });

    setLots(prev => [...prev, ...newLots]);
    return newLots;
  }, [items, calculateLotMetrics]);

  // Auto-group by condition
  const autoGroupByCondition = useCallback(() => {
    const conditionGroups: Record<string, string[]> = {};
    
    items.forEach(item => {
      const condition = item.condition || 'Unknown';
      if (!conditionGroups[condition]) {
        conditionGroups[condition] = [];
      }
      conditionGroups[condition].push(item.key);
    });

    const newLots: Lot[] = [];
    Object.entries(conditionGroups).forEach(([condition, keys]) => {
      if (keys.length >= 2) {
        const metrics = calculateLotMetrics(keys);
        newLots.push({
          id: `lot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `${condition} Condition Lot`,
          items: keys,
          ...metrics,
          createdAt: new Date(),
        });
      }
    });

    setLots(prev => [...prev, ...newLots]);
    return newLots;
  }, [items, calculateLotMetrics]);

  // Update lot
  const updateLot = useCallback((lotId: string, updates: Partial<Pick<Lot, 'name' | 'items'>>) => {
    setLots(prev => prev.map(lot => {
      if (lot.id !== lotId) return lot;
      
      const updatedItems = updates.items || lot.items;
      const metrics = calculateLotMetrics(updatedItems);
      
      return {
        ...lot,
        ...updates,
        ...metrics,
      };
    }));
  }, [calculateLotMetrics]);

  // Delete lot
  const deleteLot = useCallback((lotId: string) => {
    setLots(prev => prev.filter(lot => lot.id !== lotId));
  }, []);

  // Add items to lot
  const addItemsToLot = useCallback((lotId: string, itemKeys: string[]) => {
    setLots(prev => prev.map(lot => {
      if (lot.id !== lotId) return lot;
      
      const newItems = [...new Set([...lot.items, ...itemKeys])];
      const metrics = calculateLotMetrics(newItems);
      
      return {
        ...lot,
        items: newItems,
        ...metrics,
      };
    }));
  }, [calculateLotMetrics]);

  // Remove items from lot
  const removeItemsFromLot = useCallback((lotId: string, itemKeys: string[]) => {
    setLots(prev => prev.map(lot => {
      if (lot.id !== lotId) return lot;
      
      const newItems = lot.items.filter(key => !itemKeys.includes(key));
      const metrics = calculateLotMetrics(newItems);
      
      return {
        ...lot,
        items: newItems,
        ...metrics,
      };
    }));
  }, [calculateLotMetrics]);

  // Toggle item selection
  const toggleItemSelection = useCallback((itemKey: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  // Select all
  const selectAll = useCallback(() => {
    setSelectedItems(new Set(items.map(item => item.key)));
  }, [items]);

  // Lot analytics
  const analytics = useMemo((): LotAnalytics => {
    if (lots.length === 0) {
      return {
        totalLots: 0,
        totalLotValue: 0,
        highestValueLot: null,
        lowestValueLot: null,
        averageLotValue: 0,
        totalLotProfit: { low: 0, high: 0 },
      };
    }

    const totalLotValue = lots.reduce((sum, lot) => sum + lot.combinedValue, 0);
    const sortedByValue = [...lots].sort((a, b) => b.combinedValue - a.combinedValue);
    
    return {
      totalLots: lots.length,
      totalLotValue,
      highestValueLot: sortedByValue[0],
      lowestValueLot: sortedByValue[sortedByValue.length - 1],
      averageLotValue: Math.round(totalLotValue / lots.length),
      totalLotProfit: {
        low: lots.reduce((sum, lot) => sum + lot.projectedProfit.low, 0),
        high: lots.reduce((sum, lot) => sum + lot.projectedProfit.high, 0),
      },
    };
  }, [lots]);

  // Get items not in any lot
  const unassignedItems = useMemo(() => {
    const assignedKeys = new Set(lots.flatMap(lot => lot.items));
    return items.filter(item => !assignedKeys.has(item.key));
  }, [items, lots]);

  // Get lot by item key
  const getLotByItemKey = useCallback((itemKey: string): Lot | null => {
    return lots.find(lot => lot.items.includes(itemKey)) || null;
  }, [lots]);

  // Clear all lots
  const clearAllLots = useCallback(() => {
    setLots([]);
  }, []);

  return {
    lots,
    selectedItems,
    analytics,
    unassignedItems,
    createLot,
    createLotFromSelection,
    autoGroupByCategory,
    autoGroupByCondition,
    updateLot,
    deleteLot,
    addItemsToLot,
    removeItemsFromLot,
    toggleItemSelection,
    clearSelection,
    selectAll,
    getLotByItemKey,
    clearAllLots,
  };
}

/* ───────────────── SESSION PERSISTENCE ───────────────── */

export interface SessionState {
  items: LotItem[];
  lots: Lot[];
  lastUpdated: string;
}

export function saveSession(userId: string, state: SessionState) {
  try {
    localStorage.setItem(
      `${SESSION_STORAGE_KEY}-${userId}`,
      JSON.stringify({
        ...state,
        lastUpdated: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error('Failed to save session:', err);
  }
}

export function loadSession(userId: string): SessionState | null {
  try {
    const stored = localStorage.getItem(`${SESSION_STORAGE_KEY}-${userId}`);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      lots: parsed.lots?.map((lot: any) => ({
        ...lot,
        createdAt: new Date(lot.createdAt),
      })) || [],
    };
  } catch (err) {
    console.error('Failed to load session:', err);
    return null;
  }
}

export function clearSession(userId: string) {
  try {
    localStorage.removeItem(`${SESSION_STORAGE_KEY}-${userId}`);
    localStorage.removeItem(`${LOT_STORAGE_KEY}-${userId}`);
  } catch (err) {
    console.error('Failed to clear session:', err);
  }
}
