import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

interface AnimatedCounterProps {
  value: string;
  className?: string;
  duration?: number;
}

export function AnimatedCounter({ value, className = "", duration = 2 }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    if (!isInView) return;

    // Extract numeric part and suffix
    const match = value.match(/^((?:A\$)|(?:AUD\s*)|(?:\$))?(\d+(?:,\d{3})*(?:\.\d+)?)(.*)/);
    if (!match) {
      setDisplayValue(value);
      return;
    }

    const prefix = match[1];
    const numericValue = parseFloat(match[2].replace(/,/g, ""));
    const suffix = match[3];
    const isDecimal = match[2].includes(".");

    const startTime = performance.now();
    const durationMs = duration * 1000;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = numericValue * eased;

      if (isDecimal) {
        setDisplayValue(`${prefix}${current.toFixed(1)}${suffix}`);
      } else {
        setDisplayValue(`${prefix}${Math.round(current).toLocaleString()}${suffix}`);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, value, duration]);

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      {displayValue}
    </motion.span>
  );
}
