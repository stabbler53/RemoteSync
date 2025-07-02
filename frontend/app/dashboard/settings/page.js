'use client';

import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import TeamSelector from '../../../components/TeamSelector'; // Adjust path as needed
import SettingsForm from '../../../components/SettingsForm'; // Adjust path as needed
import MembersList from '../../../components/MembersList';
import SubmissionDashboard from '../../../components/SubmissionDashboard';

export default function SettingsPage() {
    const { getToken } = useAuth();
    const { user } = useUser();
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('profile');

    useEffect(() => {
        const fetchTeams = async () => {
            if (!user) return;
            try {
                const token = await getToken();
                const response = await fetch('/api/dashboard', { // Using dashboard endpoint to get teams
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch teams.');
                const data = await response.json();
                setTeams(data.teams || []);
                if (data.teams && data.teams.length > 0) {
                    setSelectedTeam(data.teams[0]);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTeams();
    }, [user, getToken]);

    const handleTeamChange = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        setSelectedTeam(team);
    };

    const handleSettingsUpdate = (updatedTeam) => {
        // Refresh local data after an update
        setSelectedTeam(updatedTeam);
        setTeams(currentTeams => currentTeams.map(t => t.id === updatedTeam.id ? updatedTeam : t));
    };

    if (isLoading) return <div className="p-8">Loading settings...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (teams.length === 0) return <div className="p-8">You are not a member of any team.</div>;

    const isOwner = selectedTeam && user && selectedTeam.owner_id === user.id;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold mb-6">Team Administration</h1>
            <div className="mb-6 max-w-sm">
                <TeamSelector teams={teams} selectedTeamId={selectedTeam?.id} onTeamChange={handleTeamChange} />
            </div>

            {selectedTeam && (
                <div>
                    <div className="border-b border-gray-200 mb-6">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`${
                                    activeTab === 'profile'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Profile
                            </button>
                            <button
                                onClick={() => setActiveTab('settings')}
                                className={`${
                                    activeTab === 'settings'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                General Settings
                            </button>
                            <button
                                onClick={() => setActiveTab('members')}
                                className={`${
                                    activeTab === 'members'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Members
                            </button>
                        </nav>
                    </div>

                    {activeTab === 'profile' && user && (
                        <div className="mb-8">
                            <div className="flex items-center gap-6 mb-6">
                                <img src={user.imageUrl} alt="Avatar" className="w-20 h-20 rounded-full border" />
                                <div>
                                    <div className="font-bold text-xl">{user.fullName || user.username}</div>
                                    <div className="text-gray-600">{user.primaryEmailAddress?.emailAddress}</div>
                                </div>
                            </div>
                            <SubmissionDashboard userId={user.id} />
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        isOwner ? (
                            <SettingsForm 
                                team={selectedTeam} 
                                getToken={getToken} 
                                onSettingsUpdated={handleSettingsUpdate}
                            />
                        ) : (
                            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
                                <p className="font-bold">Admin Required</p>
                                <p>You must be the team owner to change these settings.</p>
                            </div>
                        )
                    )}
                    
                    {activeTab === 'members' && (
                         <MembersList 
                            team={selectedTeam}
                            currentUser={user}
                            getToken={getToken}
                        />
                    )}
                </div>
            )}
        </div>
    );
} 