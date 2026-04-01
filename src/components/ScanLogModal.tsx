import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Trash2,
  Package,
  Calendar,
  Tag,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatAud } from "@/lib/utils";

interface PricingSource {
  marketplace: string;
  title: string;
  price: number;
  condition: string;
  soldDate: string;
}

interface ScanLogEntry {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  condition: string | null;
  low_price: number | null;
  median_price: number | null;
  high_price: number | null;
  confidence: number | null;
  trend: string | null;
  pricing_sources: PricingSource[] | null;
  scanned_at: string;
}

interface ScanLogModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export function ScanLogModal({ open, onClose, userId }: ScanLogModalProps) {
  const [logs, setLogs] = useState<ScanLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ScanLogEntry | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("scan_logs")
        .select("*")
        .eq("user_id", userId)
        .order("scanned_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      const mapped = (data || []).map((d: any) => ({
        ...d,
        pricing_sources: d.pricing_sources as PricingSource[] | null,
      }));
      setLogs(mapped);
    } catch (err) {
      console.error("Failed to fetch scan logs:", err);
      toast.error("Failed to load scan history");
    } finally {
      setLoading(false);
    }
  };

  const deleteLog = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from("scan_logs")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setLogs((prev) => prev.filter((log) => log.id !== id));
      if (selectedLog?.id === id) setSelectedLog(null);
      toast.success("Entry deleted");
    } catch (err) {
      console.error("Failed to delete log:", err);
      toast.error("Failed to delete entry");
    } finally {
      setDeleting(null);
    }
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return "bg-muted text-muted-foreground";
    if (confidence >= 80) return "bg-success/20 text-success";
    if (confidence >= 60) return "bg-warning/20 text-warning";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Scan History
            {logs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {logs.length} items
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Log List */}
          <ScrollArea className="flex-1 border-r">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                <Package className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">No scans yet</p>
                <p className="text-sm text-muted-foreground/70">
                  Items you save during live scan will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-center gap-3 ${
                      selectedLog?.id === log.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{log.name}</p>
                        {log.trend === "up" && (
                          <TrendingUp className="w-3 h-3 text-success flex-shrink-0" />
                        )}
                        {log.trend === "down" && (
                          <TrendingDown className="w-3 h-3 text-destructive flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {log.median_price && (
                          <span className="font-semibold text-foreground">
                            {formatAud(log.median_price)}
                          </span>
                        )}
                        {log.brand && (
                          <>
                            <span>•</span>
                            <span className="truncate">{log.brand}</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {format(new Date(log.scanned_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Detail Panel */}
          <div className="w-72 p-4 overflow-y-auto hidden sm:block">
            {selectedLog ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedLog.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(selectedLog.scanned_at), "PPp")}
                  </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedLog.brand && (
                    <Badge variant="outline" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {selectedLog.brand}
                    </Badge>
                  )}
                  {selectedLog.model && (
                    <Badge variant="outline" className="text-xs">
                      {selectedLog.model}
                    </Badge>
                  )}
                  {selectedLog.category && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedLog.category}
                    </Badge>
                  )}
                  {selectedLog.condition && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedLog.condition}
                    </Badge>
                  )}
                </div>

                {/* Price Card */}
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <DollarSign className="w-5 h-5 text-primary" />
                    <span className="text-2xl font-bold">
                      {formatAud(selectedLog.median_price, { fallback: "N/A" })}
                    </span>
                    {selectedLog.trend === "up" && (
                      <TrendingUp className="w-4 h-4 text-success" />
                    )}
                    {selectedLog.trend === "down" && (
                      <TrendingDown className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    <div>
                      <span className="text-muted-foreground">Low: </span>
                      <span className="font-medium">{formatAud(selectedLog.low_price)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">High: </span>
                      <span className="font-medium">{formatAud(selectedLog.high_price)}</span>
                    </div>
                  </div>
                  {selectedLog.confidence && (
                    <Badge
                      className={`mt-2 ${getConfidenceColor(selectedLog.confidence)}`}
                    >
                      {selectedLog.confidence}% confidence
                    </Badge>
                  )}
                </div>

                {/* Pricing Sources */}
                {selectedLog.pricing_sources && selectedLog.pricing_sources.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Recent Sales
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedLog.pricing_sources.map((src, i) => (
                        <div
                          key={i}
                          className="bg-background rounded p-2 text-xs"
                        >
                          <div className="flex justify-between items-center">
                            <Badge variant="outline" className="text-[10px]">
                              {src.marketplace}
                            </Badge>
                            <span className="font-bold">{formatAud(src.price)}</span>
                          </div>
                          <p className="text-muted-foreground truncate mt-1">
                            {src.title}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delete Button */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => deleteLog(selectedLog.id)}
                  disabled={deleting === selectedLog.id}
                >
                  {deleting === selectedLog.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete Entry
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <Package className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Select an item to view details</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
