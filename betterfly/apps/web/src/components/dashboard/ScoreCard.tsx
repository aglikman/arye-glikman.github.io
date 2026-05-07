import type { ScoreCard as ScoreCardType } from "@betterfly/shared";
import { SeverityBadge } from "@/components/ui/severity-badge";

const COLOR_BAR: Record<string, string> = {
  green:   "bg-green-500",
  yellow:  "bg-yellow-500",
  orange:  "bg-orange-500",
  red:     "bg-red-500",
  dark_red:"bg-red-900",
};

interface ScoreCardProps {
  card: ScoreCardType;
  language?: "en" | "he";
}

export function ScoreCardComponent({ card, language = "en" }: ScoreCardProps) {
  const label = card.label[language];
  const pct = Math.min(Math.round((card.score / card.max_score) * 100), 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 capitalize">{label}</span>
        <SeverityBadge severity={card.severity} />
      </div>

      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-gray-900">{card.score}</span>
        <span className="text-sm text-gray-400 pb-1">/ {card.max_score}</span>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${COLOR_BAR[card.color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {card.interpretation_preview && (
        <p className="text-xs text-gray-500 line-clamp-2">{card.interpretation_preview}</p>
      )}
    </div>
  );
}
