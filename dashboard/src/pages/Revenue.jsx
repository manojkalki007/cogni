import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { DollarSign, TrendingUp, Target, ArrowDownRight, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

const STAGE_CONFIG = {
  call_completed: { label: "Call Completed", color: "bg-gray-500", badge: "secondary" },
  lead_qualified: { label: "Lead Qualified", color: "bg-blue-500", badge: "default" },
  appointment_booked: { label: "Appointment Booked", color: "bg-yellow-500", badge: "warning" },
  deal_won: { label: "Deal Won", color: "bg-green-500", badge: "success" },
};

function formatCurrency(amount, currency = "INR") {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount);
}

function FunnelStage({ stage, count, total, index, nextCount }) {
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.call_completed;
  const pct = total > 0 ? (count / total) * 100 : 0;
  const conversionRate = nextCount != null && count > 0
    ? ((nextCount / count) * 100).toFixed(1)
    : null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-medium">{config.label}</span>
          <span className="text-sm text-gray-400">{count}</span>
        </div>
        <Progress value={pct} color={config.color} />
      </div>
      {conversionRate && (
        <div className="flex items-center gap-1 text-xs text-gray-500 w-20">
          <ArrowDownRight size={12} />
          {conversionRate}%
        </div>
      )}
    </div>
  );
}

export default function Revenue() {
  const { data, isLoading } = useQuery({
    queryKey: ["revenue"],
    queryFn: api.getRevenue,
    refetchInterval: 30_000,
  });

  const summary = data || {};
  const funnelStages = summary.funnel || {};
  const recentDeals = summary.recent_deals || [];
  const totalCalls = funnelStages.call_completed || 0;

  const stageOrder = ["call_completed", "lead_qualified", "appointment_booked", "deal_won"];
  const stageCounts = stageOrder.map((s) => funnelStages[s] || 0);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Revenue Attribution</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-green-400" />
              <CardTitle className="text-sm text-gray-400 font-normal">Total Revenue</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(summary.total_revenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-400" />
              <CardTitle className="text-sm text-gray-400 font-normal">Pipeline Value</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-400">
              {formatCurrency(summary.pipeline_value)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-yellow-400" />
              <CardTitle className="text-sm text-gray-400 font-normal">Conversion Rate</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-400">
              {summary.conversion_rate != null ? `${summary.conversion_rate}%` : "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-gray-400" />
              <CardTitle className="text-sm text-gray-400 font-normal">Avg Deal Size</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(summary.avg_deal_size)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="funnel">
        <TabsList>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
          <TabsTrigger value="deals">Recent Deals</TabsTrigger>
        </TabsList>

        <TabsContent value="funnel">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-gray-500 text-sm">Loading...</p>
              ) : totalCalls === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No call data yet</p>
              ) : (
                <div className="space-y-5">
                  {stageOrder.map((stage, i) => (
                    <FunnelStage
                      key={stage}
                      stage={stage}
                      count={stageCounts[i]}
                      total={totalCalls}
                      index={i}
                      nextCount={i < stageCounts.length - 1 ? stageCounts[i + 1] : null}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deals">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Deals</CardTitle>
            </CardHeader>
            <CardContent>
              {recentDeals.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No deals closed yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Caller</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentDeals.map((deal, i) => {
                      const stageConf = STAGE_CONFIG[deal.funnel_stage] || STAGE_CONFIG.call_completed;
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{deal.call_id?.slice(0, 8)}...</TableCell>
                          <TableCell>{deal.caller_number || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={stageConf.badge}>{stageConf.label}</Badge>
                          </TableCell>
                          <TableCell className="text-green-400">
                            {formatCurrency(deal.revenue_amount, deal.revenue_currency)}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {deal.conversion_at ? new Date(deal.conversion_at).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
