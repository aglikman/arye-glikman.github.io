import Link from "next/link";
import { Users, AlertTriangle, FileText, ClipboardList } from "lucide-react";

export default function DashboardHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">Overview of your clinic activity</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard icon={Users}         label="Active Clients"    value="—" color="blue" />
        <StatCard icon={ClipboardList} label="Pending Intakes"   value="—" color="orange" />
        <StatCard icon={AlertTriangle} label="Open Risk Alerts"  value="—" color="red" />
        <StatCard icon={FileText}      label="Reports to Review" value="—" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <p className="text-sm text-gray-400">No recent activity yet.</p>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Open Risk Alerts</h2>
          <p className="text-sm text-gray-400">No open alerts.</p>
        </section>
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
        <strong>Clinical reminder:</strong> All questionnaire findings require clinical interview and professional judgment. This system provides screening support only.
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: "blue" | "orange" | "red" | "purple";
}) {
  const colorMap = {
    blue:   "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    red:    "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`rounded-lg p-2.5 ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
