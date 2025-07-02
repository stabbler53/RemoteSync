"use client";
import OnboardingWizard from "../../components/OnboardingWizard";
import { useUser } from "@clerk/nextjs";

export default function OnboardingPage() {
  const { user } = useUser();

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-xl text-gray-600">Loading user...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <OnboardingWizard user={user} />
    </div>
  );
} 