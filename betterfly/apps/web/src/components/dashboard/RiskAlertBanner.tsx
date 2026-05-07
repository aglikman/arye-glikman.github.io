import type { RiskAlert } from "@betterfly/shared";
import { AlertTriangle } from "lucide-react";

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-900 text-white border-red-900",
  high:     "bg-red-100 text-red-800 border-red-300",
  medium:   "bg-orange-100 text-orange-800 border-orange-300",
  low:      "bg-yellow-100 text-yellow-800 border-yellow-300",
};

interface RiskAlertBannerProps {
  alerts: RiskAlert[];
}

export function RiskAlertBanner({ alerts }: RiskAlertBannerProps) {
  const open = alerts.filter((a) => a.status === "open");
  if (open.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {open.map((alert, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium ${SEVERITY_STYLE[alert.severity]}`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            <strong className="uppercase tracking-wide">{alert.severity}</strong>
            {" — "}
            {alert.type.replace(/_/g, " ")}
            {alert.triggered_by_question && (
              <span className="opacity-70 font-normal ml-2">
                (Q: {alert.triggered_by_question})
              </span>
            )}
          </span>
          <span className="opacity-70 text-xs">{alert.status}</span>
        </div>
      ))}
    </div>
  );
}
