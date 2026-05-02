import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { api } from "../lib/api";
import { Search, Phone, User, Upload, Plus, X, FileSpreadsheet, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

function ContactForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: "", phone_number: "", email: "", company: "", tags: "", notes: "" });
  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name *</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2" placeholder="John Doe" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Phone *</label>
          <input value={form.phone_number} onChange={(e) => set("phone_number", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2" placeholder="+919876543210" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input value={form.email} onChange={(e) => set("email", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2" placeholder="john@example.com" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Company</label>
          <input value={form.company} onChange={(e) => set("company", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2" placeholder="Acme Corp" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tags (comma-separated)</label>
        <input value={form.tags} onChange={(e) => set("tags", e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2" placeholder="lead, enterprise, inbound" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 resize-none" placeholder="Any additional notes..." />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => onSubmit({ ...form, tags: form.tags ? form.tags.split(",").map(t => t.trim()) : [] })}
          disabled={!form.name || !form.phone_number}>
          <Plus size={12} /> Add Contact
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function CSVImportDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState("upload");
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importResult, setImportResult] = useState(null);

  const FIELDS = [
    { key: "phone_number", label: "Phone", required: true },
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "company", label: "Company" },
    { key: "tags", label: "Tags" },
    { key: "notes", label: "Notes" },
  ];

  const onDrop = useCallback((files) => {
    const file = files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setCsvData(result.data);
        setHeaders(result.meta.fields || []);
        const autoMap = {};
        (result.meta.fields || []).forEach((h) => {
          const lower = h.toLowerCase().replace(/[_\s-]/g, "");
          if (lower.includes("phone") || lower.includes("mobile") || lower.includes("number")) autoMap.phone_number = h;
          else if (lower === "name" || lower === "fullname") autoMap.name = h;
          else if (lower.includes("email") || lower.includes("mail")) autoMap.email = h;
          else if (lower.includes("company") || lower.includes("org")) autoMap.company = h;
          else if (lower.includes("tag")) autoMap.tags = h;
          else if (lower.includes("note")) autoMap.notes = h;
        });
        setMapping(autoMap);
        setStep("map");
      },
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "text/csv": [".csv"] }, maxFiles: 1 });

  const importMut = useMutation({
    mutationFn: (contacts) => api.importContacts(contacts),
    onSuccess: (result) => {
      setImportResult(result);
      setStep("done");
      queryClient.invalidateQueries(["contacts"]);
    },
  });

  const handleImport = () => {
    const mapped = csvData.map((row) => {
      const contact = {};
      FIELDS.forEach(({ key }) => {
        if (mapping[key]) contact[key] = row[mapping[key]] || "";
      });
      if (contact.tags && typeof contact.tags === "string") {
        contact.tags = contact.tags.split(",").map(t => t.trim()).filter(Boolean);
      }
      return contact;
    }).filter((c) => c.phone_number);
    importMut.mutate(mapped);
  };

  const handleClose = () => {
    setStep("upload");
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive ? "border-blue-500 bg-blue-500/5" : "border-gray-700 hover:border-gray-500"}`}>
            <input {...getInputProps()} />
            <FileSpreadsheet size={32} className="mx-auto mb-3 text-gray-500" />
            <p className="text-sm text-gray-400">{isDragActive ? "Drop your CSV file here..." : "Drag & drop a CSV file, or click to browse"}</p>
            <p className="text-xs text-gray-600 mt-1">Supports .csv files up to 5MB</p>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Found {csvData.length} rows. Map your CSV columns:</p>
            <div className="space-y-2">
              {FIELDS.map(({ key, label, required }) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-gray-300">{label} {required && <span className="text-red-400">*</span>}</span>
                  <select value={mapping[key] || ""} onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm">
                    <option value="">— Select column —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="bg-gray-800 rounded-lg p-3 max-h-40 overflow-auto">
              <p className="text-xs text-gray-500 mb-2">Preview (first 3 rows):</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500">
                    {FIELDS.filter(f => mapping[f.key]).map(f => <th key={f.key} className="text-left p-1">{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 3).map((row, i) => (
                    <tr key={i} className="text-gray-300">
                      {FIELDS.filter(f => mapping[f.key]).map(f => <td key={f.key} className="p-1">{row[mapping[f.key]] || "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleImport} disabled={!mapping.phone_number || importMut.isPending}>
                {importMut.isPending ? "Importing..." : `Import ${csvData.length} contacts`}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStep("upload")}>Back</Button>
            </div>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="space-y-3 text-center py-4">
            <div className="text-4xl">✓</div>
            <p className="text-lg font-medium">{importResult.imported} contacts imported</p>
            {importResult.duplicates > 0 && (
              <p className="text-sm text-yellow-400 flex items-center justify-center gap-1">
                <AlertTriangle size={14} /> {importResult.duplicates} duplicates skipped
              </p>
            )}
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Contacts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["contacts", search],
    queryFn: () => api.getContacts(search ? { search } : {}),
    refetchInterval: 30_000,
  });

  const { data: dncData } = useQuery({
    queryKey: ["dnc"],
    queryFn: api.getDNC,
  });

  const createMut = useMutation({
    mutationFn: (data) => api.createContact(data),
    onSuccess: () => { queryClient.invalidateQueries(["contacts"]); setShowAdd(false); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.deleteContact(id),
    onSuccess: () => queryClient.invalidateQueries(["contacts"]),
  });

  const contacts = data?.contacts || [];
  const dncSet = new Set((dncData?.dnc_list || []).map(d => d.phone_number || d));

  const allTags = [...new Set(contacts.flatMap(c => c.tags || []))].filter(Boolean);
  const filtered = tagFilter ? contacts.filter(c => (c.tags || []).includes(tagFilter)) : contacts;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Contacts</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
            <Upload size={14} /> Import CSV
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Contact
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-gray-900 border border-blue-800 rounded-lg p-5 mb-4">
          <h3 className="text-sm font-medium mb-3">Add Contact</h3>
          <ContactForm onSubmit={(data) => createMut.mutate(data)} onCancel={() => setShowAdd(false)} />
          {createMut.isError && <p className="text-red-400 text-xs mt-2">Failed to create contact</p>}
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
          <input type="text" placeholder="Search by name, phone, or company..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-600" />
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setTagFilter("")}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${!tagFilter ? "bg-blue-600/20 text-blue-400" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
            All
          </button>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${tagFilter === tag ? "bg-blue-600/20 text-blue-400" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Company</th>
              <th className="text-left p-3">Tags</th>
              <th className="text-left p-3">Calls</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Last Call</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                onClick={() => navigate(`/dashboard/contacts/${c.id}`)}>
                <td className="p-3 flex items-center gap-2">
                  <User size={14} className="text-gray-600" />
                  {c.name || <span className="text-gray-600">Unknown</span>}
                </td>
                <td className="p-3 font-mono text-xs">{c.phone_number}</td>
                <td className="p-3 text-gray-400">{c.company || "—"}</td>
                <td className="p-3">
                  <div className="flex gap-1 flex-wrap">
                    {(c.tags || []).slice(0, 3).map(tag => (
                      <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                </td>
                <td className="p-3">{c.total_calls || 0}</td>
                <td className="p-3">
                  {dncSet.has(c.phone_number) ? (
                    <Badge variant="destructive">DNC</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </td>
                <td className="p-3 text-gray-500 text-xs">
                  {c.last_call_at ? new Date(c.last_call_at).toLocaleDateString() : "—"}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/call?phone=${encodeURIComponent(c.phone_number)}`); }}
                      className="text-blue-400 hover:text-blue-300"><Phone size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this contact?")) deleteMut.mutate(c.id); }}
                      className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-600">
                  {contacts.length === 0 ? "No contacts yet. Add one or import a CSV." : "No contacts match the filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CSVImportDialog open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}
