import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  BarChart3, TrendingUp, Clock, PhoneIncoming, PhoneOutgoing,
  Users, Target, Bot,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const DISPOSITION_COLORS = {
  interested: "#10b981", not_interested: "#ef4444", callback_requested: "#f59e0b",
  escalated: "#f97316", no_answer: "#6b7280", voicemail: "#8b5cf6", unknown: "#374151",
};

function Stat({ icon: Icon, label, value, sub, color = "text-white" }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-gray-500" />
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children, className = "" }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-lg p-5 ${className}`}>
      <h3 className="text-sm font-medium mb-4">{title}</h3>
      {children}
    </div>
  );
}

const chartTooltipStyle = {
  contentStyle: { backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" },
  labelStyle: { color: "#9ca3af" },
};

export default function Analytics() {
  const [period, setPeriod] = useState(30);

  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.getStats, refetchInterval: 30_000 });
  const { data: trendsData } = useQuery({
    queryKey: ["analytics-trends", period],
    queryFn: () => api.getAnalyticsTrends(period),
  });
  const { data: agentsData } = useQuery({
    queryKey: ["analytics-agents"],
    queryFn: api.getAgentComparison,
  });
  const { data: callsData } = useQuery({
    queryKey: ["calls-analytics"],
    queryFn: () => api.getCalls({ limit: 500 }),
  });

  const today = stats?.today || {};
  const trends = trendsData?.trends || [];
  const agentStats = agentsData?.agents || [];
  const calls = callsData?.calls || [];

  const dispositions = {};
  let totalSentimentScore = 0;
  let sentimentCount = 0;
  let totalQuality = 0;
  let qualityCount = 0;

  calls.forEach((c) => {
    if (c.disposition) dispositions[c.disposition] = (dispositions[c.disposition] || 0) + 1;
    if (c.sentiment_score != null) { totalSentimentScore += c.sentiment_score; sentimentCount++; }
    if (c.quality_score != null) { totalQuality += c.quality_score; qualityCount++; }
  });

  const avgSentiment = sentimentCount > 0 ? (totalSentimentScore / sentimentCount).toFixed(2) : "—";
  const avgQuality = qualityCount > 0 ? Math.round((totalQuality / qualityCount) * 100) + "%" : "—";

  const pieData = Object.entries(dispositions).map(([name, value]) => ({ name, value }));
  const totalDispositions = pieData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Analytics</h2>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setPeriod(d)}
              className={`px-3 py-1 rounded-md text-xs transition-colors ${period === d ? "bg-gray-900 text-white" : "text-gray-400 hover:text-white"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={BarChart3} label="Today's Calls" value={today.total_calls ?? "—"} />
        <Stat icon={PhoneIncoming} label="Inbound" value={today.inbound ?? "—"} />
        <Stat icon={PhoneOutgoing} label="Outbound" value={today.outbound ?? "—"} />
        <Stat icon={Clock} label="Avg Duration" value={today.avg_duration_seconds ? `${today.avg_duration_seconds}s` : "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Stat icon={TrendingUp} label="Avg Sentiment" value={avgSentiment} sub="Scale: -1.0 to 1.0" />
        <Stat icon={Target} label="Avg Quality" value={avgQuality} sub="Agent performance" />
        <Stat icon={Users} label="Active Calls" value={stats?.active_calls ?? 0} color="text-green-400" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Calls Trend">
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <Tooltip {...chartTooltipStyle} />
                    <Area type="monotone" dataKey="inbound" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Inbound" />
                    <Area type="monotone" dataKey="outbound" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Outbound" />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-600 text-sm text-center py-12">No data for this period</p>}
            </ChartCard>

            <ChartCard title="Disposition Breakdown">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                      paddingAngle={2} dataKey="value" label={({ name, value }) => `${name} (${Math.round(value / totalDispositions * 100)}%)`}>
                      {pieData.map((entry, i) => (
                        <Cell key={entry.name} fill={DISPOSITION_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-600 text-sm text-center py-12">No disposition data yet</p>}
            </ChartCard>

            <ChartCard title="Average Duration (seconds)">
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <Tooltip {...chartTooltipStyle} />
                    <Line type="monotone" dataKey="avg_duration" stroke="#f59e0b" strokeWidth={2} dot={false} name="Avg Duration" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-600 text-sm text-center py-12">No data</p>}
            </ChartCard>

            <ChartCard title="Conversion Rate (%)">
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <Tooltip {...chartTooltipStyle} />
                    <Line type="monotone" dataKey="conversion_rate" stroke="#10b981" strokeWidth={2} dot={false} name="Conversion %" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-600 text-sm text-center py-12">No data</p>}
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="agents">
          {agentStats.length > 0 ? (
            <div className="space-y-4">
              <ChartCard title="Agent Comparison — Total Calls">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={agentStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <YAxis type="category" dataKey="agent_name" tick={{ fontSize: 11, fill: "#9ca3af" }} width={120} />
                    <Tooltip {...chartTooltipStyle} />
                    <Bar dataKey="total_calls" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Total Calls" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Conversion Rate by Agent">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={agentStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="agent_name" tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <Tooltip {...chartTooltipStyle} />
                      <Bar dataKey="conversion_rate" fill="#10b981" radius={[4, 4, 0, 0]} name="Conversion %" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Avg Sentiment by Agent">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={agentStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="agent_name" tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} domain={[-1, 1]} />
                      <Tooltip {...chartTooltipStyle} />
                      <Bar dataKey="avg_sentiment" radius={[4, 4, 0, 0]} name="Avg Sentiment">
                        {agentStats.map((entry, i) => (
                          <Cell key={i} fill={entry.avg_sentiment >= 0 ? "#10b981" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                      <th className="text-left p-3">Agent</th>
                      <th className="text-left p-3">Calls</th>
                      <th className="text-left p-3">Avg Duration</th>
                      <th className="text-left p-3">Conversion</th>
                      <th className="text-left p-3">Avg Sentiment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentStats.map(a => (
                      <tr key={a.agent_id} className="border-b border-gray-800/50">
                        <td className="p-3 flex items-center gap-2"><Bot size={14} className="text-blue-400" /> {a.agent_name}</td>
                        <td className="p-3">{a.total_calls}</td>
                        <td className="p-3 text-gray-400">{a.avg_duration}s</td>
                        <td className="p-3">
                          <span className={a.conversion_rate > 20 ? "text-green-400" : "text-gray-400"}>{a.conversion_rate}%</span>
                        </td>
                        <td className="p-3">
                          <span className={a.avg_sentiment >= 0 ? "text-green-400" : "text-red-400"}>{a.avg_sentiment}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Bot size={32} className="mx-auto mb-3 text-gray-600" />
              <p className="text-gray-500">No agent data yet. Create agents and start making calls.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
