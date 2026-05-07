import { cn } from "@/lib/utils";
import type { Severity } from "@betterfly/shared";

const SEVERITY_STYLES: Record<Severity, string> = {
  minimal:          "bg-green-100 text-green-800",
  mild:             "bg-yellow-100 text-yellow-800",
  moderate:         "bg-orange-100 text-orange-800",
  moderately_severe:"bg-red-100 text-red-800",
  severe:           "bg-red-200 text-red-900",
  critical:         "bg-red-900 text-white",
};

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        SEVERITY_STYLES[severity],
        className
      )}
    >
      {severity.replace("_", " ")}
    </span>
  );
}
