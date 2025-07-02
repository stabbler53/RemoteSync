"use client";
import React, { useState } from "react";
import { useAuth } from "@clerk/nextjs";

// Placeholder components for each step
const Step1_Welcome = ({ nextStep }) => (
  <div>
    <h2 className="text-2xl font-bold mb-4">Welcome to RemoteSync!</h2>
    <p className="mb-6">Let's get you set up. You can start with a team or use it solo for now.</p>
    <button onClick={nextStep} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">Get Started</button>
  </div>
);

const Step2_TeamName = ({ teamData, setTeamData, nextStep }) => (
  <div>
    <h2 className="text-2xl font-bold mb-2">Create Your Team</h2>
    <p className="text-gray-600 mb-6">Give your team a name. You can upload a logo later.</p>
    <input
      type="text"
      className="w-full border rounded p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
      placeholder="e.g., The A-Team"
      value={teamData.name || ""}
      onChange={e => setTeamData({ ...teamData, name: e.target.value })}
    />
    <button onClick={nextStep} disabled={!teamData.name} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400">Next</button>
  </div>
);

const Step3_Settings = ({ teamData, setTeamData, nextStep }) => (
    <div>
      <h2 className="text-2xl font-bold mb-2">Team Settings</h2>
      <p className="text-gray-600 mb-6">Set your team's timezone and when you'd like to receive daily summary reports.</p>
      <div className="mb-4">
        <label className="block text-gray-700 font-medium mb-1">Timezone</label>
        <select
            className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={teamData.timezone || ""}
            onChange={e => setTeamData({ ...teamData, timezone: e.target.value })}>
            {/* Add a real list of timezones here */}
            <option value="GMT-8">Pacific Time (GMT-8)</option>
            <option value="GMT-5">Eastern Time (GMT-5)</option>
        </select>
      </div>
      <div>
        <label className="block text-gray-700 font-medium mb-1">Daily Summary Time</label>
        <input type="time"
            className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={teamData.summaryTime || "18:00"}
            onChange={e => setTeamData({ ...teamData, summaryTime: e.target.value })} />
      </div>
      <button onClick={nextStep} className="w-full bg-blue-600 text-white py-3 mt-6 rounded-lg font-semibold hover:bg-blue-700">Next</button>
    </div>
);

const Step4_Invites = ({ teamData, setTeamData, handleSubmit }) => (
    <div>
        <h2 className="text-2xl font-bold mb-2">Invite Your Team</h2>
        <p className="text-gray-600 mb-6">Invite members via email (comma-separated).</p>
        <textarea 
            className="w-full border rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="teammate1@example.com, teammate2@example.com"
            rows={3}
            value={teamData.invites || ""}
            onChange={e => setTeamData({ ...teamData, invites: e.target.value })}
        />
        <button onClick={handleSubmit} className="w-full bg-blue-600 text-white py-3 mt-4 rounded-lg font-semibold hover:bg-blue-700">Send Invites & Finish</button>
    </div>
);

const Step5_Complete = () => (
    <div className="text-center">
      <h2 className="text-2xl font-bold mb-4">You're All Set!</h2>
      <p>Your team has been created. You can now start submitting your daily standups.</p>
      <a href="/dashboard" className="inline-block mt-6 bg-green-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-600">Go to Dashboard</a>
    </div>
);

export default function OnboardingWizard({ user }) {
  const [step, setStep] = useState(1);
  const [teamData, setTeamData] = useState({ name: "", settings: { timezone: "GMT-5", summaryTime: "18:00" }, invites: "" });
  const [error, setError] = useState("");
  const { getToken } = useAuth();

  const nextStep = () => setStep(s => s + 1);

  const handleSubmit = async () => {
    setError("");
    try {
        const token = await getToken();

        // 1. Create the team
        const teamRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: teamData.name, settings: teamData.settings }),
        });
        if (!teamRes.ok) throw new Error("Failed to create team.");
        const newTeam = await teamRes.json();

        // 2. Send invites
        const emails = teamData.invites.split(',').map(e => e.trim()).filter(e => e);
        if (emails.length > 0) {
            const inviteRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/teams/${newTeam.id}/invites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ emails }),
            });
            if (!inviteRes.ok) throw new Error("Failed to send invites.");
        }
        
        nextStep(); // Move to completion step

    } catch (err) {
        setError(err.message);
    }
  };

  const steps = [
    <Step1_Welcome nextStep={nextStep} />,
    <Step2_TeamName teamData={teamData} setTeamData={setTeamData} nextStep={nextStep} />,
    <Step3_Settings teamData={teamData} setTeamData={setTeamData} nextStep={nextStep} />,
    <Step4_Invites teamData={teamData} setTeamData={setTeamData} handleSubmit={handleSubmit} />,
    <Step5_Complete />
  ];

  return (
    <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-8 space-y-6">
      <div className="relative pt-1">
        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
          <div style={{ width: `${(step / (steps.length - 1)) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500"></div>
        </div>
      </div>
      {error && <div className="text-red-500 bg-red-100 p-3 rounded">{error}</div>}
      {steps[step - 1]}
    </div>
  );
} 