import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ArrowLeft, Phone, Save } from "lucide-react";

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  const { data: contact } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => api.getContact(id),
  });

  const save = useMutation({
    mutationFn: (data) => api.updateContact(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["contact", id]);
      setEditing(false);
    },
  });

  if (!contact || contact.error) {
    return <p className="text-gray-500">Contact not found</p>;
  }

  const startEdit = () => {
    setForm({
      name: contact.name || "",
      email: contact.email || "",
      company: contact.company || "",
      notes: contact.notes || "",
    });
    setEditing(true);
  };

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate("/dashboard/contacts")} className="flex items-center gap-1 text-gray-500 hover:text-white text-sm mb-4">
        <ArrowLeft size={14} /> Back to Contacts
      </button>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">{contact.name || "Unknown Contact"}</h2>
            <p className="text-gray-500 font-mono text-sm">{contact.phone_number}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/dashboard/call?phone=${encodeURIComponent(contact.phone_number)}`)}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-sm"
            >
              <Phone size={12} /> Call
            </button>
            {!editing && (
              <button onClick={startEdit} className="px-3 py-1.5 border border-gray-700 rounded text-sm hover:bg-gray-800">
                Edit
              </button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            {["name", "email", "company", "notes"].map((field) => (
              <div key={field}>
                <label className="block text-xs text-gray-500 uppercase mb-1">{field}</label>
                {field === "notes" ? (
                  <textarea
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm resize-none"
                  />
                ) : (
                  <input
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                  />
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => save.mutate(form)}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-sm"
              >
                <Save size={12} /> Save
              </button>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-gray-400 hover:text-white text-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase">Email</p>
              <p>{contact.email || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Company</p>
              <p>{contact.company || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Total Calls</p>
              <p>{contact.total_calls || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Language</p>
              <p>{contact.language || "en"}</p>
            </div>
            {contact.notes && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase">Notes</p>
                <p className="text-gray-400">{contact.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {contact.calls && contact.calls.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-3">Call History</h3>
          <div className="space-y-2">
            {contact.calls.map((call) => (
              <div key={call.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">
                    {call.direction} &middot; {call.duration_seconds || 0}s &middot; {call.provider || "twilio"}
                  </span>
                  <span className="text-gray-600 text-xs">
                    {call.started_at ? new Date(call.started_at).toLocaleString() : ""}
                  </span>
                </div>
                {call.summary && <p className="text-sm text-gray-400">{call.summary}</p>}
                {call.disposition && (
                  <span className="inline-block mt-2 text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                    {call.disposition}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
