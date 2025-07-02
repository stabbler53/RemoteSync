"use client";
import { SignIn, SignUp, UserButton, useUser, useAuth } from "@clerk/nextjs";
import { useState } from "react";
import VoiceRecorder from "../components/VoiceRecorder";
import TeamSelector from "../components/TeamSelector";

export default function Home() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [text, setText] = useState("");
  const [audio, setAudio] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setConfirmation("");
    try {
      const token = await getToken();
      const form = new FormData();
      form.append("name", user?.fullName || user?.username || "");
      form.append("text", text);
      if (audio) form.append("audio", audio);
      form.append("team_id", selectedTeam);
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/submit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error("Submission failed");
      setSummary("");
      setText("");
      setAudio(null);
      setConfirmation("✅ Update received! You'll be included in today's standup summary.");
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">RemoteSync Standup</h1>
          <UserButton afterSignOutUrl="/" />
        </div>
        {!user ? (
          <div>
            <SignIn afterSignInUrl="/" afterSignUpUrl="/" />
            <SignUp afterSignInUrl="/" afterSignUpUrl="/" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <TeamSelector userId={user.id} onSelect={setSelectedTeam} selectedTeam={selectedTeam} />
            <label className="block text-gray-700 font-medium mb-1">What did you work on today?</label>
            <textarea
              className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Type your update... (emojis, bullets, paragraphs supported)"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
            />
            <div className="my-2">
              <VoiceRecorder onRecordingComplete={setAudio} maxDuration={120} />
            </div>
            <button
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-blue-700 transition"
              type="submit"
              disabled={loading || (!text && !audio) || !selectedTeam}
            >
              {loading ? "Submitting..." : "Submit Update"}
            </button>
            {confirmation && <div className="text-green-600 text-center mt-4 font-medium">{confirmation}</div>}
            {error && <div className="text-red-500 text-center mt-4">{error}</div>}
          </form>
        )}
      </div>
    </div>
  );
} 