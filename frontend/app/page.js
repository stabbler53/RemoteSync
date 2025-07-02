"use client";
import { SignIn, SignUp, UserButton, useUser, useAuth } from "@clerk/nextjs";
import { useState } from "react";

export default function Home() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [text, setText] = useState("");
  const [audio, setAudio] = useState(null);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      const form = new FormData();
      form.append("name", user?.fullName || user?.username || "");
      form.append("text", text);
      if (audio) form.append("audio", audio);
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/submit", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error("Submission failed");
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">RemoteSync Standup</h1>
        <SignIn afterSignInUrl="/" afterSignUpUrl="/" />
        <SignUp afterSignInUrl="/" afterSignUpUrl="/" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">RemoteSync Standup</h1>
        <UserButton afterSignOutUrl="/" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea className="w-full border p-2" placeholder="Type your update..." value={text} onChange={e => setText(e.target.value)} />
        <input type="file" accept="audio/*" onChange={e => setAudio(e.target.files[0])} />
        <button className="bg-blue-500 text-white px-4 py-2 rounded" type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit"}</button>
      </form>
      {error && <div className="text-red-500 mt-2">{error}</div>}
      {summary && (
        <div className="mt-4 p-2 border bg-gray-50">
          <h2 className="font-bold">Summary:</h2>
          <pre>{summary}</pre>
        </div>
      )}
    </div>
  );
} 