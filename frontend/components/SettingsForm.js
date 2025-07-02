'use client';
import { useState, useEffect } from 'react';

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function SettingsForm({ team, getToken, onSettingsUpdated }) {
    const [summaryTime, setSummaryTime] = useState('17:00');
    const [weeklyReportDay, setWeeklyReportDay] = useState('Friday');
    const [recipients, setRecipients] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (team) {
            setSummaryTime(team.settings?.summaryTime || '17:00');
            setWeeklyReportDay(team.settings?.weeklyReportDay || 'Friday');
            setRecipients((team.report_recipients || []).join(', '));
        }
    }, [team]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setSuccess(false);

        const recipientList = recipients.split(',').map(email => email.trim()).filter(Boolean);

        try {
            const token = await getToken();
            const response = await fetch(`/api/teams/${team.id}/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    settings: { 
                        summaryTime,
                        weeklyReportDay,
                    },
                    report_recipients: recipientList,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update settings');
            }

            const data = await response.json();
            onSettingsUpdated(data.team);
            setSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="summaryTime" className="block text-sm font-medium text-gray-700">
                        Daily Summary Time (UTC)
                    </label>
                    <input
                        type="time"
                        id="summaryTime"
                        value={summaryTime}
                        onChange={(e) => setSummaryTime(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    />
                </div>
                <div>
                    <label htmlFor="weeklyReportDay" className="block text-sm font-medium text-gray-700">
                        Weekly Summary Day
                    </label>
                    <select
                        id="weeklyReportDay"
                        value={weeklyReportDay}
                        onChange={(e) => setWeeklyReportDay(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    >
                        {daysOfWeek.map(day => (
                            <option key={day} value={day}>{day}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label htmlFor="recipients" className="block text-sm font-medium text-gray-700">
                    Report Recipients
                </label>
                <textarea
                    id="recipients"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder="Enter email addresses, separated by commas"
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-2 text-sm text-gray-500">
                    A comma-separated list of emails that will receive the daily report.
                </p>
            </div>

            <div>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                >
                    {isSubmitting ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            {success && <p className="text-green-600">Settings saved successfully!</p>}
            {error && <p className="text-red-600">{error}</p>}
        </form>
    );
} 