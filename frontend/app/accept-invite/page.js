'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

export default function AcceptInvitePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { getToken, isSignedIn } = useAuth();
    
    const [status, setStatus] = useState('Processing invitation...');
    const [error, setError] = useState(null);

    useEffect(() => {
        const token = searchParams.get('token');

        if (!token) {
            setStatus('No invitation token found.');
            return;
        }

        if (!isSignedIn) {
            // If the user is not signed in, they will be redirected by Clerk's middleware.
            // We can show a message here, or rely on the redirect.
            setStatus('Please sign in or sign up to accept the invitation.');
            // Clerk's <RedirectToSignIn /> would typically handle this in the layout.
            return;
        }

        const accept = async () => {
            try {
                const authToken = await getToken();
                const response = await fetch('/api/invites/accept', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({ token }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to accept invitation.');
                }
                
                setStatus('Successfully joined the team! Redirecting to your dashboard...');
                
                // Redirect to the dashboard after a short delay
                setTimeout(() => {
                    router.push('/dashboard');
                }, 2000);

            } catch (err) {
                setError(err.message);
                setStatus('Could not process invitation.');
            }
        };

        accept();

    }, [searchParams, getToken, router, isSignedIn]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
                <h1 className="text-2xl font-bold mb-4">Accepting Invitation</h1>
                <p className="text-gray-600 mb-6">{status}</p>
                {error && <p className="text-red-500 bg-red-100 p-3 rounded-md">{error}</p>}
                
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mt-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mt-2"></div>
                </div>
            </div>
        </div>
    );
} 