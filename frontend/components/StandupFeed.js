'use client';

function StandupCard({ entry }) {
    const { user_info, summary, created_at } = entry;
    const date = new Date(created_at).toLocaleString();

    return (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
            <div className="flex items-center mb-2">
                <img 
                    src={user_info.image_url || '/default-avatar.png'} 
                    alt={user_info.first_name || 'User'} 
                    className="w-10 h-10 rounded-full mr-3" 
                />
                <div>
                    <p className="font-semibold">{user_info.first_name} {user_info.last_name}</p>
                    <p className="text-sm text-gray-500">{date}</p>
                </div>
            </div>
            <div className="prose prose-sm max-w-none">
                <p>{summary}</p>
            </div>
        </div>
    );
}


export default function StandupFeed({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-700">No updates yet</h3>
        <p className="text-gray-500">Be the first to post an update for this team!</p>
      </div>
    );
  }

  return (
    <div>
      {entries.map(entry => (
        <StandupCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
} 