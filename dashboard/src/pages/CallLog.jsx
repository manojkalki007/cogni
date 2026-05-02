import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  PhoneIncoming, PhoneOutgoing, Clock, ChevronDown, ChevronUp,
  Search, Filter, User, MessageSquare,
} from "lucide-react";
import { Badge } from "../components/ui/badge";

const DISPOSITION_VARIANT = {
  interested: "success", not_interested: "destructive", callback_requested: "warning",
  escalated: "warning", no_answer: "secondary", voicemail: "secondary",
};

const SENTIMENT_BADGE = (score) => {
  if (score == null) return null;
  if (score > 0.3) return { label: "Positive", variant: "success" };
  if (score < -0.3) return { label: "Negative", variant: "destructive" };
  return { label: "Neutral", variant: "secondary" };
};

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={14} className="text-gray-500" />}
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function TranscriptView({ transcript }) {
  if (!transcript || transcript.length === 0) return <p className="text-gray-500 text-sm">No transcript available</p>;
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {transcript.map((t, i) => (
        <div key={i} className={`text-sm flex gap-2 ${t.role === "agent" ? "text-blue-300" : "text-gray-300"}`}>
          <span className="font-medium text-xs uppercase text-gray-500 w-12 shrink-0">{t.role}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CallLog() {
  const [expandedId, setExpandedId] = useState(null);
  const [dirFilter, setDirFilter] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: api.getStats,
    refetchInterval: 15_000,
  });

  const { data: callsData } = useQuery({
    queryKey: ["calls", dirFilter],
    queryFn: () => api.getCalls(dirFilter ? { direction: dirFilter } : {}),
    refetchInterval: 10_000,
  });

  const allCalls = callsData?.calls || [];

  const calls = allCalls.filter((c) => {
    if (dispositionFilter && c.disposition !== dispositionFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.caller_number || "").includes(q) ||
      (c.summary || "").toLowerCase().includes(q) ||
      (c.agent_name || "").toLowerCase().includes(q)
    );
  });

  const today = stats?.today || {};
  const dispositions = [...new Set(allCalls.map(c => c.disposition).filter(Boolean))];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Call Log</h2>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Calls" value={today.total_calls ?? "—"} icon={MessageSquare} />
        <StatCard label="Inbound" value={today.inbound ?? "—"} icon={PhoneIncoming} />
        <StatCard label="Outbound" value={today.outbound ?? "—"} icon={PhoneOutgoing} />
        <StatCard label="Avg Duration" value={today.avg_duration_seconds ? `${today.avg_duration_seconds}s` : "—"} icon={Clock} />
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
          <input type="text" placeholder="Search by caller, agent, or summary..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-600" />
        </div>
        <select value={dirFilter} onChange={(e) => setDirFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm">
          <option value="">All directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        {dispositions.length > 0 && (
          <select value={dispositionFilter} onChange={(e) => setDispositionFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm">
            <option value="">All dispositions</option>
            {dispositions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="text-left p-3 w-10"></th>
              <th className="text-left p-3">Caller</th>
              <th className="text-left p-3">Agent</th>
              <th className="text-left p-3">Duration</th>
              <th className="text-left p-3">Disposition</th>
              <th className="text-left p-3">Sentiment</th>
              <th className="text-left p-3">Summary</th>
              <th className="text-left p-3">Date</th>
              <th className="p-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => {
              const sentiment = SENTIMENT_BADGE(call.sentiment_score);
              const isExpanded = expandedId === call.id;
              return (
                <tr key={call.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 group">
                  <td className="p-3">
                    {call.direction === "inbound" ? (
                      <PhoneIncoming size={14} className="text-green-400" />
                    ) : (
                      <PhoneOutgoing size={14} className="text-blue-400" />
                    )}
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-xs">{call.caller_number || "—"}</span>
                  </td>
                  <td className="p-3 text-gray-400 text-xs">{call.agent_name || "Default"}</td>
                  <td className="p-3">
                    <span className="flex items-center gap-1 text-gray-400">
                      <Clock size={10} />
                      {formatDuration(call.duration_seconds)}
                    </span>
                  </td>
                  <td className="p-3">
                    {call.disposition ? (
                      <Badge variant={DISPOSITION_VARIANT[call.disposition] || "outline"} className="text-[10px]">
                        {call.disposition}
                      </Badge>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="p-3">
                    {sentiment ? (
                      <Badge variant={sentiment.variant} className="text-[10px]">{sentiment.label}</Badge>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="p-3 text-gray-400 max-w-xs truncate text-xs">{call.summary || "—"}</td>
                  <td className="p-3 text-gray-500 text-xs whitespace-nowrap">
                    {call.created_at ? new Date(call.created_at).toLocaleString() : call.started_at ? new Date(call.started_at).toLocaleString() : "—"}
                  </td>
                  <td className="p-3">
                    <button onClick={() => setExpandedId(isExpanded ? null : call.id)}
                      className="text-gray-500 hover:text-white">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </td>
                </tr>
              );
            })}
            {calls.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-600">No calls match your filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expandedId && (
        <div className="mt-2 bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={14} className="text-gray-500" />
            <h3 className="text-sm font-medium">Transcript</h3>
          </div>
          <TranscriptView transcript={calls.find(c => c.id === expandedId)?.transcript} />
        </div>
      )}

      <p className="text-xs text-gray-600 mt-3 text-right">Showing {calls.length} of {allCalls.length} calls</p>
    </div>
  );
}
