import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Gauge, Zap, Mic, Brain, Volume2, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";

const TARGET_MS = 500;
const WARN_MS = 800;

function getLatencyColor(ms) {
  if (ms == null) return "text-gray-500";
  if (ms <= TARGET_MS) return "text-green-400";
  if (ms <= WARN_MS) return "text-yellow-400";
  return "text-red-400";
}

function getBarColor(ms) {
  if (ms == null) return "bg-gray-600";
  if (ms <= TARGET_MS) return "bg-green-500";
  if (ms <= WARN_MS) return "bg-yellow-500";
  return "bg-red-500";
}

function getBadgeVariant(ms) {
  if (ms == null) return "secondary";
  if (ms <= TARGET_MS) return "success";
  if (ms <= WARN_MS) return "warning";
  return "destructive";
}

function LatencyCard({ icon: Icon, label, description, value, unit = "ms", maxValue = 1000 }) {
  const ms = value;
  const pct = ms != null ? (ms / maxValue) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={16} className="text-gray-500" />
            <CardTitle className="text-sm">{label}</CardTitle>
          </div>
          <Badge variant={getBadgeVariant(ms)}>
            {ms != null ? (ms <= TARGET_MS ? "Good" : ms <= WARN_MS ? "Slow" : "Critical") : "N/A"}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1 mb-2">
          <span className={`text-3xl font-bold ${getLatencyColor(ms)}`}>
            {ms != null ? ms : "—"}
          </span>
          <span className="text-sm text-gray-500">{unit}</span>
        </div>
        <Progress value={pct} color={getBarColor(ms)} />
        <div className="flex justify-between mt-1.5 text-xs text-gray-600">
          <span>0ms</span>
          <span className="text-green-600">Target: {TARGET_MS}ms</span>
          <span>{maxValue}ms</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Latency() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["latency"],
    queryFn: api.getLatency,
    refetchInterval: 60_000,
  });

  const services = data?.services || {};
  const overall = data?.overall || {};

  const serviceMetrics = [
    {
      key: "stt",
      icon: Mic,
      label: "Speech-to-Text",
      description: "Deepgram / Sarvam AI transcription latency",
      value: services.stt_ms ?? services.deepgram_ms,
    },
    {
      key: "llm",
      icon: Brain,
      label: "LLM (Time to First Token)",
      description: "Groq / OpenAI response generation",
      value: services.llm_ttft_ms ?? services.groq_ms ?? services.openai_ms,
    },
    {
      key: "tts",
      icon: Volume2,
      label: "Text-to-Speech",
      description: "Smallest AI / Cartesia / Sarvam synthesis",
      value: services.tts_ttfb_ms ?? services.smallest_ms ?? services.tts_ms,
    },
    {
      key: "total",
      icon: Zap,
      label: "Total Round-Trip",
      description: "End-to-end: user stops speaking → agent audio starts",
      value: overall.total_ms ?? services.total_ms,
      maxValue: 1500,
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Latency Monitor</h2>
          <p className="text-sm text-gray-500 mt-1">Target: sub-{TARGET_MS}ms end-to-end response</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          {isFetching ? "Measuring..." : "Measure Now"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-gray-500 text-sm text-center py-12">Measuring service latencies...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {serviceMetrics.map((m) => (
              <LatencyCard
                key={m.key}
                icon={m.icon}
                label={m.label}
                description={m.description}
                value={m.value}
                maxValue={m.maxValue || 1000}
              />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Optimization Techniques</CardTitle>
              <CardDescription>Active latency reduction strategies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { name: "Semantic EOT", desc: "Multi-signal turn detection", active: true },
                  { name: "Speculative Pre-gen", desc: "Start LLM while user speaks", active: true },
                  { name: "Sentence Streaming", desc: "TTS per sentence, not full response", active: true },
                  { name: "Filler Audio", desc: "Pre-cached phrases during tool calls", active: true },
                  { name: "Groq Fast LLM", desc: "~80ms TTFT primary provider", active: !!services.groq_ms },
                  { name: "Smallest AI TTS", desc: "Native mulaw output, no conversion", active: !!services.smallest_ms || !!services.tts_ms },
                  { name: "Barge-in Detection", desc: "Energy-based interruption handling", active: true },
                  { name: "Per-turn Tracing", desc: "Component-level latency measurement", active: true },
                  { name: "Context Window Trim", desc: "Keep last 20 messages only", active: true },
                ].map((tech) => (
                  <div key={tech.name} className="flex items-start gap-2 p-3 rounded-lg bg-gray-800/50">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${tech.active ? "bg-green-500" : "bg-gray-600"}`} />
                    <div>
                      <p className="text-sm font-medium">{tech.name}</p>
                      <p className="text-xs text-gray-500">{tech.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {data?.per_turn_avg && (
            <>
              <Separator className="my-6" />
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Per-Turn Averages (Recent Calls)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <p className={`text-2xl font-bold ${getLatencyColor(data.per_turn_avg.llm_ttft)}`}>
                        {data.per_turn_avg.llm_ttft ?? "—"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">LLM TTFT (ms)</p>
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${getLatencyColor(data.per_turn_avg.tts_ttfb)}`}>
                        {data.per_turn_avg.tts_ttfb ?? "—"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">TTS TTFB (ms)</p>
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${getLatencyColor(data.per_turn_avg.total)}`}>
                        {data.per_turn_avg.total ?? "—"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Total (ms)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
