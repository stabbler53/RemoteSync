"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import DashboardClient from '../../components/DashboardClient';

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await getToken();
        if (!token) {
          // No token yet, Clerk is likely still loading.
          // The effect will re-run when getToken() returns a value.
          return;
        }
        
        const response = await fetch('/api/dashboard', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to fetch dashboard data');
        }

        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [getToken]);

  if (isLoading) {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <div className="text-lg font-semibold">Loading Dashboard...</div>
        </div>
    );
  }

  if (error) {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <div className="text-red-500 bg-red-100 p-4 rounded-md">Error: {error}</div>
        </div>
    );
  }
  
  if (!dashboardData) {
      return (
          <div className="flex justify-center items-center min-h-screen">
              <div className="text-lg">No data found.</div>
          </div>
      )
  }

  return <DashboardClient initialData={dashboardData} />;
} 