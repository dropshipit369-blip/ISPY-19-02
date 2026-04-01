import { useState, useEffect } from "react";
import { MessageSquare, X, Star, Send, ThumbsUp } from "lucide-react";

interface FeedbackWidgetProps {
    trigger?: boolean;
    context?: string;
}

export const FeedbackWidget = ({ trigger = false, context = "general" }: FeedbackWidgetProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [hasPrompted, setHasPrompted] = useState(false);

    useEffect(() => {
          if (trigger && !hasPrompted && !submitted) {
                  const timer = setTimeout(() => {
                            setShowPrompt(true);
                            setHasPrompted(true);
                  }, 1800);
                  return () => clearTimeout(timer);
          }
    }, [trigger, hasPrompted, submitted]);

    const handleSubmit = () => {
          if (rating === 0 && !feedback.trim()) return;
          const entry = { context, rating, feedback, ts: new Date().toISOString() };
          const existing = JSON.parse(localStorage.getItem("ispy_feedback") || "[]");
          existing.push(entry);
          localStorage.setItem("ispy_feedback", JSON.stringify(existing));
          setSubmitted(true);
          setTimeout(() => {
                  setIsOpen(false);
                  setSubmitted(false);
                  setRating(0);
                  setFeedback("");
          }, 2000);
    };

    const dismiss = () => { setShowPrompt(false); setIsOpen(false); };

    const contextLabel: Record<string, string> = {
          scan: "your scan results",
          dashboard: "your dashboard",
          inventory: "managing inventory",
          listings: "your listings",
          general: "Ispy.ai",
    };

    return (
          <>
            {showPrompt && !isOpen && !submitted && (
                    <div className="fixed bottom-20 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
                              <div className="bg-card border border-border/60 rounded-xl shadow-lg p-3 max-w-[220px] flex flex-col gap-2">
                                          <div className="flex items-start justify-between gap-2">
                                                        <p className="text-xs text-muted-foreground leading-snug">
                                                                        How was {contextLabel[context] || "your experience"}?
                                                        </p>
                                                        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
                                                                        <X size={12} />
                                                        </button>
                                          </div>
                                          <button
                                                          onClick={() => { setIsOpen(true); setShowPrompt(false); }}
                                                          className="text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-lg px-2 py-1.5 transition-colors font-medium"
                                                        >
                                                        Leave feedback
                                          </button>
                              </div>
                    </div>
                )}
            {!showPrompt && (
                    <div className="fixed bottom-4 right-4 z-50">
                              <button
                                            onClick={() => setIsOpen(true)}
                                            className="flex items-center gap-1.5 bg-card border border-border/60 hover:border-primary/40 text-muted-foreground hover:text-primary rounded-full px-3 py-2 shadow-md text-xs font-medium transition-all duration-200 hover:shadow-lg"
                                            title="Share feedback"
                                          >
                                          <MessageSquare size={13} />
                                          <span>Feedback</span>
                              </button>
                    </div>
                )}
            {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                              <div className="absolute inset-0 bg-black/40" onClick={dismiss} />
                              <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-5 w-full max-w-sm mx-4 mb-4 sm:mb-0 animate-in slide-in-from-bottom-4 fade-in duration-200">
                                          <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-2">
                                                                        <ThumbsUp size={15} className="text-primary" />
                                                                        <h3 className="font-semibold text-sm text-foreground">Quick Feedback</h3>
                                                        </div>
                                                        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground">
                                                                        <X size={16} />
                                                        </button>
                                          </div>
                                {submitted ? (
                                    <div className="text-center py-4">
                                                    <p className="text-2xl mb-2">Thanks!</p>
                                                    <p className="text-sm font-medium text-foreground">We appreciate your feedback</p>
                                                    <p className="text-xs text-muted-foreground mt-1">It helps us improve Ispy.ai</p>
                                    </div>
                                  ) : (
                                    <>
                                                    <p className="text-xs text-muted-foreground mb-3">
                                                                      How was {contextLabel[context] || "your experience"}?
                                                    </p>
                                                    <div className="flex gap-1 mb-3">
                                                      {[1, 2, 3, 4, 5].map((star) => (
                                                          <button
                                                                                  key={star}
                                                                                  onClick={() => setRating(star)}
                                                                                  className="transition-transform hover:scale-110"
                                                                                >
                                                                                <Star
                                                                                                          size={22}
                                                                                                          className={star <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/40"}
                                                                                                        />
                                                          </button>
                                                        ))}
                                                    </div>
                                                    <textarea
                                                                        value={feedback}
                                                                        onChange={(e) => setFeedback(e.target.value)}
                                                                        placeholder="Anything to share? (optional)"
                                                                        rows={3}
                                                                        className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 mb-3"
                                                                      />
                                                    <button
                                                                        onClick={handleSubmit}
                                                                        disabled={rating === 0 && !feedback.trim()}
                                                                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground text-xs font-medium rounded-lg px-4 py-2.5 transition-colors"
                                                                      >
                                                                      <Send size={12} />
                                                                      Send Feedback
                                                    </button>
                                    </>
                                  )}
                              </div>
                    </div>
                )}
          </>
        );
};

export default FeedbackWidget;
