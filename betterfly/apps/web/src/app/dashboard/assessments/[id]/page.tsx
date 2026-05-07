"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { api } from "@/lib/api";
import { ScoreCardComponent } from "@/components/dashboard/ScoreCard";
import { RiskAlertBanner } from "@/components/dashboard/RiskAlertBanner";
import type { DashboardData, DomainInterpretation, ScoreCard } from "@betterfly/shared";

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DashboardData & { interpretation?: { domain_interpretations: DomainInterpretation[] } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.get<typeof data>(`/assessments/${id}/dashboard`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function generateReport() {
    setGenerating(true);
    try {
      const report = await api.post(`/assessments/${id}/reports`, {
        type: "intake",
        language: data?.assessment.language ?? "en",
      });
      alert(`Report created. ID: ${(report as { id: string }).id}`);
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  if (!data) return <div className="p-8 text-sm text-red-500">Assessment not found.</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={`/dashboard/clients/${data.client.id}`} className="text-sm text-gray-400 hover:text-gray-600">
            ← {data.client.display_name}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {data.assessment.type.charAt(0).toUpperCase() + data.assessment.type.slice(1)} Assessment
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.assessment.submitted_at
              ? `Submitted ${new Date(data.assessment.submitted_at).toLocaleDateString()}`
              : `Status: ${data.assessment.status}`}
          </p>
        </div>
        <button
          onClick={generateReport}
          disabled={generating}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <FileText className="h-4 w-4" />
          {generating ? "Generating…" : "Generate Report"}
        </button>
      </div>

      <RiskAlertBanner alerts={data.alerts} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {data.score_cards.map((card) => (
          <ScoreCardComponent key={card.domain} card={card as ScoreCard} />
        ))}
      </div>

      {data.executive_summary && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Executive Summary</h3>
          <p className="text-sm text-blue-800 leading-relaxed">{data.executive_summary}</p>
        </div>
      )}

      {data.interpretation?.domain_interpretations && (
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-gray-800">Domain Interpretations</h2>
          {data.interpretation.domain_interpretations.map((d) => (
            <div key={d.domain} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-800 capitalize">{d.domain}</h3>
                <span className="text-sm text-gray-500">Score: {d.total_score} · {d.severity.replace("_", " ")}</span>
              </div>
              <p className="text-sm text-gray-700 mb-4">{d.interpretation_text}</p>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Suggested follow-up questions</p>
                <ul className="space-y-1">
                  {d.clinician_follow_up_questions.map((q, i) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2">
                      <span className="text-gray-400">•</span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-800">
        These findings are based on self-report screening only. They require clinical interview and professional judgment before any diagnostic conclusions are drawn.
      </div>
    </div>
  );
}
