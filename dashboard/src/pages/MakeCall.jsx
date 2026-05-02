import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Phone, Loader2 } from "lucide-react";

export default function MakeCall() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [provider, setProvider] = useState("twilio");
  const [instructions, setInstructions] = useState("");
  const [callSid, setCallSid] = useState(null);

  const makeCall = useMutation({
    mutationFn: () => api.makeCall(phoneNumber, provider, instructions),
    onSuccess: (data) => {
      if (data.call_sid) setCallSid(data.call_sid);
    },
  });

  const { data: status } = useQuery({
    queryKey: ["callStatus", callSid],
    queryFn: () => api.callStatus(callSid),
    enabled: !!callSid,
    refetchInterval: 3000,
  });

  const hangup = useMutation({
    mutationFn: () => api.hangupCall(callSid),
    onSuccess: () => setCallSid(null),
  });

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-6">Make a Call</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Phone Number</label>
          <input
            type="tel"
            placeholder="+1234567890"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm"
          >
            <option value="twilio">Twilio</option>
            <option value="exotel">Exotel</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Custom Instructions (optional)</label>
          <textarea
            placeholder="Override the default agent instructions for this call..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => makeCall.mutate()}
            disabled={!phoneNumber || makeCall.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            {makeCall.isPending ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
            Call Now
          </button>

          {callSid && (
            <button
              onClick={() => hangup.mutate()}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Hang Up
            </button>
          )}
        </div>

        {makeCall.isError && (
          <p className="text-red-400 text-sm">Failed to initiate call. Check your API keys and phone number.</p>
        )}
      </div>

      {status && (
        <div className="mt-6 bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">Call Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={status.status === "active" ? "text-green-400" : "text-gray-400"}>
                {status.status || "unknown"}
              </span>
            </div>
            {status.duration != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span>{status.duration}s</span>
              </div>
            )}
            {status.turns != null && (
              <div className="flex justify-between">
                <span className="text-gray-500">Turns</span>
                <span>{status.turns}</span>
              </div>
            )}
            {status.summary && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <p className="text-gray-500 text-xs uppercase mb-1">Summary</p>
                <p className="text-gray-300">{status.summary}</p>
              </div>
            )}
            {status.transcript && status.transcript.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <p className="text-gray-500 text-xs uppercase mb-1">Transcript</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {status.transcript.map((t, i) => (
                    <div key={i} className={t.role === "agent" ? "text-blue-300" : "text-gray-300"}>
                      <span className="text-xs text-gray-500 mr-1">{t.role}:</span>
                      {t.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
