"use client";
import { useUser } from "@clerk/nextjs";
import SubmissionDashboard from "../../components/SubmissionDashboard";
import { useState } from "react";

export default function DashboardPage() {
  const { user } = useUser();
  const [selectedTeam, setSelectedTeam] = useState("");

  // Optionally, add a TeamSelector here for admins

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center py-8">
      <SubmissionDashboard userId={user?.id} teamId={selectedTeam} />
    </div>
  );
} 