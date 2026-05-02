import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ShieldCheck, AlertTriangle, ShieldAlert, Clock, Search } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Button } from "../components/ui/button";

const SEVERITY_BADGE = {
  critical: "destructive",
  high: "destructive",
  warning: "warning",
  info: "default",
  low: "secondary",
};

const TYPE_LABELS = {
  pci_violation: "PCI Violation",
  pii_detected: "PII Detected",
  prompt_injection: "Prompt Injection",
  disclosure_missing: "Missing Disclosure",
  aadhaar_detected: "Aadhaar Number",
  pan_detected: "PAN Number",
  ssn_detected: "SSN Number",
  email_detected: "Email Address",
  card_detected: "Credit Card",
};

function StatCard({ icon: Icon, label, value, iconColor }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className={iconColor} />
          <CardTitle className="text-sm text-gray-400 font-normal">{label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function Compliance() {
  const [filter, setFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["compliance"],
    queryFn: () => api.getComplianceEvents(),
    refetchInterval: 15_000,
  });

  const events = data?.events || [];

  const filtered = events.filter((e) => {
    if (severityFilter !== "all" && e.severity !== severityFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (
        (e.call_id || "").toLowerCase().includes(q) ||
        (e.type || "").toLowerCase().includes(q) ||
        (e.detail || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const criticalCount = events.filter((e) => e.severity === "critical" || e.severity === "high").length;
  const warningCount = events.filter((e) => e.severity === "warning").length;
  const infoCount = events.filter((e) => e.severity === "info" || e.severity === "low").length;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Compliance Monitor</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={ShieldCheck} label="Total Events" value={events.length} iconColor="text-blue-400" />
        <StatCard icon={ShieldAlert} label="Critical" value={criticalCount} iconColor="text-red-400" />
        <StatCard icon={AlertTriangle} label="Warnings" value={warningCount} iconColor="text-yellow-400" />
        <StatCard icon={Clock} label="Info" value={infoCount} iconColor="text-gray-400" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <CardTitle className="text-sm">Event Log</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-500" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search events..."
                  className="bg-gray-800 border border-gray-700 rounded-md pl-8 pr-3 py-1.5 text-sm w-48"
                />
              </div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm"
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              {events.length === 0 ? "No compliance events recorded" : "No events match the filter"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Call ID</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((event, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-gray-500 text-xs whitespace-nowrap">
                      {event.timestamp
                        ? new Date(event.timestamp).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {TYPE_LABELS[event.type] || event.type || "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_BADGE[event.severity] || "secondary"}>
                        {event.severity || "info"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">
                      {event.call_id ? event.call_id.slice(0, 8) + "..." : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-400 max-w-xs truncate">
                      {event.detail || event.message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
