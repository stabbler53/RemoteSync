import React, { useEffect, useState } from "react";

export default function TeamSelector({ userId, onSelect, selectedTeam }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchTeams() {
      setLoading(true);
      setError("");
      try {
        // Replace with your Supabase fetch logic or API call
        const res = await fetch("/api/teams?userId=" + userId);
        if (!res.ok) throw new Error("Failed to fetch teams");
        const data = await res.json();
        setTeams(data.teams || []);
      } catch (err) {
        setError("Could not load teams");
      }
      setLoading(false);
    }
    if (userId) fetchTeams();
  }, [userId]);

  return (
    <div className="w-full max-w-md mx-auto mb-4">
      <label className="block text-gray-700 font-medium mb-1">Team</label>
      {loading ? (
        <div className="text-blue-500">Loading teams...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <select
          className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={selectedTeam || ""}
          onChange={e => onSelect(e.target.value)}
        >
          <option value="" disabled>Select your team</option>
          {teams.map(team => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
      )}
    </div>
  );
} 