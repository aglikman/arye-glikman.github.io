"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Send, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { RiskAlertBanner } from "@/components/dashboard/RiskAlertBanner";
import { ScoreCardComponent } from "@/components/dashboard/ScoreCard";
import { ProgressChart } from "@/components/dashboard/ProgressChart";
import type { DashboardData, ScoreCard } from "@betterfly/shared";

interface Assessment {
  id: string;
  type: string;
  language: string;
  status: string;
  submitted_at?: string;
  created_at: string;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selected, setSelected] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Assessment[]>(`/clients/${id}/assessments`)
      .then((data) => {
        setAssessments(data);
        const scored = data.find((a) => a.status === "scored" || a.status === "reviewed" || a.status === "report_generated");
        if (scored) {
          return api.get<DashboardData>(`/assessments/${scored.id}/dashboard`);
        }
      })
      .then((dash) => { if (dash) setSelected(dash); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function sendIntake() {
    try {
      const result = await api.post<{ intake_url: string }>("/assessments", {
        client_id: id,
        type: "intake",
        language: "en",
      });
      alert(`Intake link created:\n${result.intake_url}`);
    } catch (e) {
      alert(`Error: ${(e as Error).message}`);
    }
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/clients" className="text-sm text-gray-400 hover:text-gray-600">
            ← Clients
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {selected?.client.display_name ?? "Client"}
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={sendIntake}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Send className="h-4 w-4" />
            Send Intake
          </button>
        </div>
      </div>

      {selected && (
        <>
          <RiskAlertBanner alerts={selected.alerts} />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {selected.score_cards.map((card) => (
              <ScoreCardComponent key={card.domain} card={card as ScoreCard} />
            ))}
          </div>

          {selected.executive_summary && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Executive Summary</h3>
              <p className="text-sm text-blue-800">{selected.executive_summary}</p>
              <p className="text-xs text-blue-600 mt-3 italic">
                These are screening findings only. They require clinical interview and professional judgment.
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h3 className="text-base font-semibold text-gray-800 mb-4">Progress Over Time</h3>
            <ProgressChart data={selected.charts?.timeline ?? []} />
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-800">Assessments</h3>
          <button
            onClick={sendIntake}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus className="h-4 w-4" />
            New assessment
          </button>
        </div>
        {assessments.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No assessments yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Language</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Submitted</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-3 capitalize">{a.type}</td>
                  <td className="px-5 py-3 uppercase text-xs">{a.language}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {(a.status === "scored" || a.status === "reviewed") && (
                      <Link
                        href={`/dashboard/assessments/${a.id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        View results
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
