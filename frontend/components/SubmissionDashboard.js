import React, { useEffect, useState } from "react";

export default function SubmissionDashboard({ userId, teamId }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function fetchSubmissions() {
      setLoading(true);
      setError("");
      try {
        // Replace with your API endpoint
        let url = `/api/submissions?userId=${userId || ""}&teamId=${teamId || ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch submissions");
        const data = await res.json();
        setSubmissions(data.submissions || []);
      } catch (err) {
        setError("Could not load submissions");
      }
      setLoading(false);
    }
    fetchSubmissions();
  }, [userId, teamId]);

  const filtered = submissions.filter(s =>
    !filter || s.summary?.toLowerCase().includes(filter.toLowerCase()) || s.content?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow p-6 mt-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
        <h2 className="text-2xl font-bold text-blue-700">Your Submissions</h2>
        <input
          className="border rounded p-2 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Filter by keyword..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      {loading ? (
        <div className="text-blue-500">Loading...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-500">No submissions found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-blue-100">
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Content</th>
                <th className="p-2 text-left">Summary</th>
                <th className="p-2 text-left">Audio</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sub => (
                <tr key={sub.id} className="border-b hover:bg-blue-50">
                  <td className="p-2">{new Date(sub.created_at).toLocaleString()}</td>
                  <td className="p-2">{sub.type}</td>
                  <td className="p-2 max-w-xs truncate" title={sub.content}>{sub.content}</td>
                  <td className="p-2 max-w-xs truncate" title={sub.summary}>{sub.summary}</td>
                  <td className="p-2">
                    {sub.audio_url ? (
                      <audio controls src={sub.audio_url} className="w-32" />
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 