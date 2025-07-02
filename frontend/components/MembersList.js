'use client';
import { useState, useEffect } from 'react';

// This is a simplified fetch function. In a real app, you might get this data from the initial dashboard load.
async function fetchTeamMembers(teamId, getToken) {
    const token = await getToken();
    const response = await fetch(`/api/teams/${teamId}/members`, { 
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch team members.');
    }
    return response.json();
}


export default function MembersList({ team, currentUser, getToken }) {
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (team) {
            setIsLoading(true);
            fetchTeamMembers(team.id, getToken)
                .then(data => setMembers(data))
                .catch(err => setError(err.message))
                .finally(() => setIsLoading(false));
        }
    }, [team, getToken]);

    const handleRemove = async (memberId) => {
        if (!confirm('Are you sure you want to remove this member?')) return;
        
        try {
            const token = await getToken();
            const response = await fetch(`/api/teams/${team.id}/members/${memberId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to remove member.');
            }
            
            // Refresh the list
            setMembers(currentMembers => currentMembers.filter(m => m.id !== memberId));

        } catch (err) {
            setError(err.message);
        }
    };

    if (isLoading) return <p>Loading members...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="space-y-4">
            {members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center">
                        <img src={member.image_url || '/default-avatar.png'} alt={member.first_name} className="w-10 h-10 rounded-full mr-4" />
                        <span>{member.first_name} {member.last_name}</span>
                    </div>
                    {currentUser.id === team.owner_id && member.id !== team.owner_id && (
                        <button onClick={() => handleRemove(member.id)} className="text-sm font-medium text-red-600 hover:text-red-800">
                            Remove
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
} 