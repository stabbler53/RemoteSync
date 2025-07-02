'use client';

import { useState } from 'react';
import TeamSelector from './TeamSelector';
import StandupFeed from './StandupFeed';
import SubmissionForm from './SubmissionForm';

export default function DashboardClient({ initialData }) {
  const [teams, setTeams] = useState(initialData.teams || []);
  const [entries, setEntries] = useState(initialData.entries || []);
  const [selectedTeamId, setSelectedTeamId] = useState(teams.length > 0 ? teams[0].id : null);

  const handleTeamChange = (teamId) => {
    setSelectedTeamId(teamId);
  };
  
  const onNewEntry = (newEntry) => {
    // Add the new entry to the top of the feed for immediate feedback
    setEntries([newEntry, ...entries]);
  };

  const filteredEntries = entries.filter(entry => entry.team_id === selectedTeamId);

  return (
    <div className="container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            {teams.length > 1 && (
                <TeamSelector 
                    teams={teams} 
                    selectedTeamId={selectedTeamId} 
                    onTeamChange={handleTeamChange} 
                />
            )}
        </div>
        <StandupFeed entries={filteredEntries} />
      </div>
      <div className="lg:col-span-1">
        <SubmissionForm selectedTeamId={selectedTeamId} onNewEntry={onNewEntry} />
      </div>
    </div>
  );
} 