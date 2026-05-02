import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  Plus, Save, Bot, Copy, Upload, Loader2, Trash2,
  PhoneOutgoing, BarChart3, Sliders, Wrench, Shield, Brain,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Separator } from "../components/ui/separator";

const LLM_MODELS = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
};

const TTS_PROVIDERS = ["cartesia", "smallest", "elevenlabs", "sarvam"];

const AVAILABLE_TOOLS = [
  { id: "book_appointment", label: "Book Appointment", icon: "📅" },
  { id: "transfer_call", label: "Transfer Call", icon: "📞" },
  { id: "save_contact_info", label: "Save Contact", icon: "💾" },
  { id: "send_followup", label: "Send Follow-up", icon: "📧" },
  { id: "send_whatsapp", label: "Send WhatsApp", icon: "💬" },
  { id: "check_availability", label: "Check Calendar", icon: "📆" },
  { id: "create_payment_link", label: "Payment Link", icon: "💳" },
];

const LANGUAGES = [
  { code: "en", label: "English" }, { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" }, { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" }, { code: "ml", label: "Malayalam" },
  { code: "bn", label: "Bengali" }, { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" }, { code: "en-in", label: "English (Indian)" },
];

function AgentFormDialog({ open, onOpenChange, agent, onSave }) {
  const isEdit = !!agent;
  const [form, setForm] = useState(() => ({
    name: agent?.name || "",
    instructions: agent?.instructions || "",
    greeting: agent?.greeting || "",
    language: agent?.language || "en",
    voice_id: agent?.voice_id || "",
    phone_numbers: (agent?.phone_numbers || []).join(", "),
    llm_provider: agent?.llm_provider || "groq",
    llm_model: agent?.llm_model || "llama-3.3-70b-versatile",
    tts_provider: agent?.tts_provider || "cartesia",
    temperature: agent?.temperature ?? 0.7,
    max_call_duration: agent?.max_call_duration || 600,
    enable_memory: agent?.enable_memory ?? true,
    enable_prediction: agent?.enable_prediction ?? true,
    enable_emotion: agent?.enable_emotion ?? true,
    enable_language_switch: agent?.enable_language_switch ?? true,
    enable_rag: agent?.enable_rag ?? false,
    tools_enabled: agent?.tools_enabled || AVAILABLE_TOOLS.map(t => t.id),
    guardrails: agent?.guardrails || {},
  }));

  const set = (k, v) => setForm({ ...form, [k]: v });

  const handleSave = () => {
    onSave({
      ...form,
      phone_numbers: form.phone_numbers.split(",").map(n => n.trim()).filter(Boolean),
      temperature: parseFloat(form.temperature),
      max_call_duration: parseInt(form.max_call_duration),
    });
  };

  const toggleTool = (toolId) => {
    const tools = form.tools_enabled.includes(toolId)
      ? form.tools_enabled.filter(t => t !== toolId)
      : [...form.tools_enabled, toolId];
    set("tools_enabled", tools);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Agent" : "Create Agent"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList>
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="llm">LLM & Voice</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Agent Name *</label>
                <input value={form.name} onChange={(e) => set("name", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2" placeholder="Lead Qualifier" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">System Prompt *</label>
                <textarea value={form.instructions} onChange={(e) => set("instructions", e.target.value)}
                  rows={6} className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 resize-none font-mono text-xs"
                  placeholder="You are a professional sales agent..." />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Greeting Message</label>
                <input value={form.greeting} onChange={(e) => set("greeting", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2"
                  placeholder="Hello! Thanks for calling Cogniflow. How can I help you today?" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Language</label>
                  <select value={form.language} onChange={(e) => set("language", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2">
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Phone Numbers (comma-separated)</label>
                  <input value={form.phone_numbers} onChange={(e) => set("phone_numbers", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2" placeholder="+1234, +5678" />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="llm">
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">LLM Provider</label>
                  <select value={form.llm_provider} onChange={(e) => {
                    set("llm_provider", e.target.value);
                    set("llm_model", (LLM_MODELS[e.target.value] || [])[0] || "");
                  }} className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2">
                    {Object.keys(LLM_MODELS).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Model</label>
                  <select value={form.llm_model} onChange={(e) => set("llm_model", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2">
                    {(LLM_MODELS[form.llm_provider] || []).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Temperature: {form.temperature}</label>
                <input type="range" min="0" max="2" step="0.1" value={form.temperature}
                  onChange={(e) => set("temperature", e.target.value)}
                  className="w-full accent-blue-500" />
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>Precise (0)</span><span>Creative (2)</span>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">TTS Provider</label>
                  <select value={form.tts_provider} onChange={(e) => set("tts_provider", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2">
                    {TTS_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Voice ID</label>
                  <input value={form.voice_id} onChange={(e) => set("voice_id", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2" placeholder="Voice ID" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Call Duration (seconds)</label>
                <input type="number" value={form.max_call_duration} onChange={(e) => set("max_call_duration", e.target.value)}
                  className="w-32 bg-gray-800 border border-gray-700 rounded-md px-3 py-2" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tools">
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Enable the tools this agent can use during calls:</p>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_TOOLS.map(tool => (
                  <button key={tool.id} onClick={() => toggleTool(tool.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm text-left transition-colors ${
                      form.tools_enabled.includes(tool.id)
                        ? "border-blue-600 bg-blue-600/10 text-white"
                        : "border-gray-700 bg-gray-800/50 text-gray-400"
                    }`}>
                    <span className="text-lg">{tool.icon}</span>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="features">
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Toggle AI features for this agent:</p>
              {[
                { key: "enable_memory", label: "Caller Memory", desc: "Remember callers across sessions", icon: Brain },
                { key: "enable_prediction", label: "Pre-Call Prediction", desc: "Predict caller intent before answering", icon: BarChart3 },
                { key: "enable_emotion", label: "Emotional Mirroring", desc: "Adapt tone based on caller sentiment", icon: Sliders },
                { key: "enable_language_switch", label: "Language Switching", desc: "Auto-detect and switch languages mid-call", icon: Wrench },
                { key: "enable_rag", label: "Knowledge Base (RAG)", desc: "Use uploaded documents during calls", icon: Shield },
              ].map(({ key, label, desc, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    <Icon size={16} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </div>
                  <button onClick={() => set(key, !form[key])}
                    className={`w-10 h-5 rounded-full transition-colors relative ${form[key] ? "bg-blue-600" : "bg-gray-600"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form[key] ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={!form.name || !form.instructions}>
            <Save size={14} /> {isEdit ? "Save Changes" : "Create Agent"}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TestCallWidget({ agent }) {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState(null);

  const callMut = useMutation({
    mutationFn: () => api.makeCall(phone, "twilio", agent.instructions),
    onSuccess: (data) => setStatus(data.error ? `Error: ${data.error}` : `Call started: ${data.call_sid}`),
    onError: () => setStatus("Failed to start call"),
  });

  return (
    <div className="flex items-center gap-2 mt-3">
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..."
        className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-xs" />
      <Button size="sm" variant="outline" onClick={() => callMut.mutate()} disabled={!phone || callMut.isPending}>
        <PhoneOutgoing size={12} /> Test
      </Button>
      {status && <span className="text-xs text-gray-400">{status}</span>}
    </div>
  );
}

function AgentPerformance({ agentId }) {
  const { data } = useQuery({
    queryKey: ["agent-perf", agentId],
    queryFn: () => api.getAgentPerformance(agentId),
    enabled: !!agentId,
  });

  if (!data || data.total_calls === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-2 mt-3">
      {[
        { label: "Calls", value: data.total_calls },
        { label: "Avg Duration", value: `${data.avg_duration}s` },
        { label: "Sentiment", value: data.avg_sentiment },
        { label: "Conversion", value: `${data.conversion_rate}%` },
      ].map(({ label, value }) => (
        <div key={label} className="bg-gray-800/50 rounded p-2 text-center">
          <p className="text-[10px] text-gray-500 uppercase">{label}</p>
          <p className="text-sm font-bold">{value}</p>
        </div>
      ))}
    </div>
  );
}

function AgentCard({ agent, onEdit, onDelete, onClone }) {
  const [showTest, setShowTest] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-blue-400" />
            <CardTitle className="text-base">{agent.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={agent.is_active ? "success" : "secondary"}>
              {agent.is_active ? "Active" : "Inactive"}
            </Badge>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => onEdit(agent)}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => onClone(agent)}><Copy size={12} /></Button>
              <Button variant="ghost" size="sm" onClick={() => setShowTest(!showTest)}>
                <PhoneOutgoing size={12} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this agent?")) onDelete(agent.id); }}>
                <Trash2 size={12} />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-400 line-clamp-2 mb-2">{agent.instructions}</p>
        <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
          <span>{agent.llm_provider || "groq"} / {agent.llm_model || "llama-3.3-70b"}</span>
          <span>TTS: {agent.tts_provider || "cartesia"}</span>
          <span>Lang: {agent.language || "en"}</span>
          <span>Numbers: {(agent.phone_numbers || []).length}</span>
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {agent.enable_memory && <Badge variant="outline" className="text-[10px]">Memory</Badge>}
          {agent.enable_prediction && <Badge variant="outline" className="text-[10px]">Prediction</Badge>}
          {agent.enable_emotion && <Badge variant="outline" className="text-[10px]">Emotion</Badge>}
          {agent.enable_language_switch && <Badge variant="outline" className="text-[10px]">Lang Switch</Badge>}
          {agent.enable_rag && <Badge variant="outline" className="text-[10px]">RAG</Badge>}
        </div>
        <AgentPerformance agentId={agent.id} />
        {showTest && <TestCallWidget agent={agent} />}
      </CardContent>
    </Card>
  );
}

function CloneDialog({ open, onOpenChange, sourceAgent }) {
  const queryClient = useQueryClient();
  const [recordings, setRecordings] = useState("");
  const [agentName, setAgentName] = useState("");
  const [cloneResult, setCloneResult] = useState(null);

  const cloneMut = useMutation({
    mutationFn: (data) => api.cloneAgent(data),
    onSuccess: (result) => { setCloneResult(result); queryClient.invalidateQueries(["agents"]); },
  });

  const handleClone = () => {
    cloneMut.mutate({
      agent_name: agentName || `Clone of ${sourceAgent?.name || "Agent"}`,
      recording_urls: recordings.split("\n").map(u => u.trim()).filter(Boolean),
    });
  };

  const handleClose = () => { setRecordings(""); setAgentName(""); setCloneResult(null); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Clone Agent from Recordings</DialogTitle>
          <DialogDescription>Upload call recordings to generate a new agent that mimics the style.</DialogDescription>
        </DialogHeader>
        {cloneResult ? (
          <div className="space-y-3">
            <Badge variant="success">Clone Generated</Badge>
            <div className="bg-gray-800 rounded-md p-3 text-sm text-gray-300 max-h-48 overflow-auto whitespace-pre-wrap">
              {cloneResult.instructions || "Agent cloned successfully"}
            </div>
            <Button onClick={handleClose} className="w-full">Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">New Agent Name</label>
              <input value={agentName} onChange={(e) => setAgentName(e.target.value)}
                placeholder={`Clone of ${sourceAgent?.name || "Agent"}`}
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Recording URLs (one per line)</label>
              <textarea value={recordings} onChange={(e) => setRecordings(e.target.value)}
                rows={4} placeholder="https://storage.example.com/call-1.mp3"
                className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm resize-none font-mono" />
            </div>
            <Button onClick={handleClone} disabled={cloneMut.isPending || !recordings.trim()} className="w-full">
              {cloneMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Analyzing...</> : <><Upload size={14} /> Clone Agent</>}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Agents() {
  const queryClient = useQueryClient();
  const [formDialog, setFormDialog] = useState({ open: false, agent: null });
  const [cloneDialog, setCloneDialog] = useState({ open: false, source: null });

  const { data } = useQuery({ queryKey: ["agents"], queryFn: api.getAgents });
  const agents = data?.agents || [];

  const createMut = useMutation({
    mutationFn: (data) => api.createAgent(data),
    onSuccess: () => { queryClient.invalidateQueries(["agents"]); setFormDialog({ open: false, agent: null }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.updateAgent(id, data),
    onSuccess: () => { queryClient.invalidateQueries(["agents"]); setFormDialog({ open: false, agent: null }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.deleteAgent(id),
    onSuccess: () => queryClient.invalidateQueries(["agents"]),
  });

  const handleSave = (data) => {
    if (formDialog.agent) {
      updateMut.mutate({ id: formDialog.agent.id, data });
    } else {
      createMut.mutate(data);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Agents</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCloneDialog({ open: true, source: null })}>
            <Copy size={14} /> Clone from Recordings
          </Button>
          <Button size="sm" onClick={() => setFormDialog({ open: true, agent: null })}>
            <Plus size={14} /> New Agent
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {agents.map((a) => (
          <AgentCard key={a.id} agent={a}
            onEdit={(agent) => setFormDialog({ open: true, agent })}
            onDelete={(id) => deleteMut.mutate(id)}
            onClone={(agent) => setCloneDialog({ open: true, source: agent })} />
        ))}
        {agents.length === 0 && (
          <div className="text-center py-12">
            <Bot size={32} className="mx-auto mb-3 text-gray-600" />
            <p className="text-gray-500">No agents configured. Using default agent.</p>
            <Button size="sm" className="mt-3" onClick={() => setFormDialog({ open: true, agent: null })}>
              <Plus size={14} /> Create Your First Agent
            </Button>
          </div>
        )}
      </div>

      <AgentFormDialog open={formDialog.open} onOpenChange={(open) => setFormDialog({ open, agent: formDialog.agent })}
        agent={formDialog.agent} onSave={handleSave} />
      <CloneDialog open={cloneDialog.open} onOpenChange={(open) => setCloneDialog({ open, source: cloneDialog.source })}
        sourceAgent={cloneDialog.source} />
    </div>
  );
}
