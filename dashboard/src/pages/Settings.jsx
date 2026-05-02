import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Plus, Trash2, Upload, Shield } from "lucide-react";

function WebhookSection() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("call.completed");

  const { data } = useQuery({ queryKey: ["webhooks"], queryFn: api.getWebhooks });
  const webhooks = data?.webhooks || [];

  const createMut = useMutation({
    mutationFn: () => api.createWebhook(url, events.split(",").map((e) => e.trim())),
    onSuccess: () => { queryClient.invalidateQueries(["webhooks"]); setUrl(""); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.deleteWebhook(id),
    onSuccess: () => queryClient.invalidateQueries(["webhooks"]),
  });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <h3 className="text-sm font-medium mb-4">Webhooks</h3>
      <p className="text-xs text-gray-500 mb-4">Send signed HTTP POST to external URLs when events occur. Works with Zapier, Make, n8n.</p>

      <div className="flex gap-2 mb-4">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-webhook-url.com"
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" />
        <input value={events} onChange={(e) => setEvents(e.target.value)} placeholder="Events"
          className="w-48 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" />
        <button onClick={() => createMut.mutate()} disabled={!url}
          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded text-sm">
          <Plus size={12} /> Add
        </button>
      </div>

      <div className="space-y-2">
        {webhooks.map((w) => (
          <div key={w.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2 text-sm">
            <div>
              <span className="font-mono text-xs">{w.url}</span>
              <span className="ml-2 text-xs text-gray-500">{(w.events || []).join(", ")}</span>
              {w.failure_count > 0 && (
                <span className="ml-2 text-xs text-red-400">{w.failure_count} failures</span>
              )}
            </div>
            <button onClick={() => deleteMut.mutate(w.id)} className="text-gray-500 hover:text-red-400">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {webhooks.length === 0 && <p className="text-gray-600 text-sm">No webhooks configured</p>}
      </div>
    </div>
  );
}

function DNCSection() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");

  const { data } = useQuery({ queryKey: ["dnc"], queryFn: () => fetch("/api/dnc").then((r) => r.json()) });
  const dncList = data?.dnc_list || [];

  const addMut = useMutation({
    mutationFn: () => fetch("/api/dnc", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phone }),
    }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries(["dnc"]); setPhone(""); },
  });

  const removeMut = useMutation({
    mutationFn: (number) => fetch(`/api/dnc/${encodeURIComponent(number)}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries(["dnc"]),
  });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-red-400" />
        <h3 className="text-sm font-medium">Do Not Call List</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">Numbers on this list are automatically skipped in campaigns. Auto-added when callers say "stop calling".</p>

      <div className="flex gap-2 mb-4">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1234567890"
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm" />
        <button onClick={() => addMut.mutate()} disabled={!phone}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-3 py-1.5 rounded text-sm">Block Number</button>
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {dncList.map((d) => (
          <div key={d.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-1.5 text-sm">
            <div>
              <span className="font-mono text-xs">{d.phone_number}</span>
              <span className="ml-2 text-xs text-gray-500">{d.reason}</span>
            </div>
            <button onClick={() => removeMut.mutate(d.phone_number)} className="text-xs text-gray-500 hover:text-white">
              Remove
            </button>
          </div>
        ))}
        {dncList.length === 0 && <p className="text-gray-600 text-sm">DNC list is empty</p>}
      </div>
    </div>
  );
}

function ImportSection() {
  const [result, setResult] = useState(null);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/contacts/import", { method: "POST", body: fd });
    const data = await res.json();
    setResult(data);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Upload size={16} className="text-green-400" />
        <h3 className="text-sm font-medium">Import Contacts</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">Upload a CSV with columns: phone, name, email, company. Duplicates are skipped.</p>
      <input type="file" accept=".csv" onChange={handleImport}
        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm file:bg-gray-700 file:border-0 file:text-gray-300 file:rounded file:px-2 file:py-1 file:text-xs file:mr-2" />
      {result && (
        <p className="mt-2 text-sm text-green-400">Imported {result.imported} contacts</p>
      )}
    </div>
  );
}

export default function Settings() {
  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>
      <WebhookSection />
      <DNCSection />
      <ImportSection />
    </div>
  );
}
