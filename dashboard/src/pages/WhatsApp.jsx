import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { MessageSquare, Phone, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Separator } from "../components/ui/separator";

const TEMPLATES = [
  {
    id: "appointment_confirmation",
    name: "Appointment Confirmation",
    description: "Sends appointment date, time, and location to the caller",
    params: ["date", "time", "location"],
  },
  {
    id: "payment_link",
    name: "Payment Link",
    description: "Sends a payment link with amount details",
    params: ["amount", "link"],
  },
  {
    id: "document_share",
    name: "Document Share",
    description: "Shares a document or brochure link",
    params: ["document_name", "link"],
  },
  {
    id: "fee_details",
    name: "Fee Details",
    description: "Sends detailed fee breakdown",
    params: ["details"],
  },
];

export default function WhatsApp() {
  const { data: callsData } = useQuery({
    queryKey: ["calls-whatsapp"],
    queryFn: () => api.getCalls({ limit: 100 }),
    refetchInterval: 30_000,
  });

  const calls = callsData?.calls || [];
  const whatsappCalls = calls.filter((c) =>
    c.transcript?.some((t) => t.text?.toLowerCase().includes("whatsapp"))
  );

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">WhatsApp Integration</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-green-400" />
              <CardTitle className="text-sm text-gray-400 font-normal">Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-green-400" />
              <span className="text-lg font-semibold text-green-400">Connected</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">WhatsApp Business API via tool calling</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Phone size={16} className="text-blue-400" />
              <CardTitle className="text-sm text-gray-400 font-normal">How It Works</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-300">
              During live calls, the AI agent can send WhatsApp messages to the caller using the <Badge variant="outline">send_whatsapp</Badge> tool.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-yellow-400" />
              <CardTitle className="text-sm text-gray-400 font-normal">Calls with WhatsApp</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{whatsappCalls.length}</p>
            <p className="text-xs text-gray-500 mt-1">of {calls.length} recent calls</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Message Templates</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEMPLATES.map((tpl) => (
              <Card key={tpl.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{tpl.name}</CardTitle>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <CardDescription>{tpl.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {tpl.params.map((p) => (
                      <Badge key={p} variant="outline" className="font-mono text-xs">
                        {`{{${p}}}`}
                      </Badge>
                    ))}
                  </div>
                  <Separator className="my-3" />
                  <p className="text-xs text-gray-500">
                    Template ID: <span className="font-mono">{tpl.id}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Calls Mentioning WhatsApp</CardTitle>
            </CardHeader>
            <CardContent>
              {whatsappCalls.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  No WhatsApp activity in recent calls
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Call ID</TableHead>
                      <TableHead>Caller</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {whatsappCalls.map((call, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">
                          {call.call_id?.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{call.caller_number || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={call.direction === "inbound" ? "default" : "secondary"}>
                            {call.direction}
                          </Badge>
                        </TableCell>
                        <TableCell>{call.duration_seconds ? `${call.duration_seconds}s` : "—"}</TableCell>
                        <TableCell className="text-gray-500 text-xs">
                          {call.started_at ? new Date(call.started_at).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
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
