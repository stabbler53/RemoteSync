'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';

export default function SubmissionForm({ selectedTeamId, onNewEntry }) {
  const { getToken } = useAuth();
  const [text, setText] = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleStartRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        audioChunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access in your browser settings.');
    }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !audioBlob) {
      setError('Please provide either text or an audio recording.');
      return;
    }
    if (!selectedTeamId) {
      setError('A team must be selected to post an update.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('team_id', selectedTeamId);
      formData.append('text', text);

      if (audioBlob) {
        formData.append('audio', audioBlob, 'standup.wav');
      }

      const response = await fetch('/api/entry', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit entry');
      }

      const newEntryData = await response.json();
      onNewEntry(newEntryData.entry); 
      setText('');
      setAudioBlob(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Post an Update</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did you work on today? (Optional if recording audio)"
          className="w-full p-2 border rounded-md mb-4 h-32"
          disabled={isSubmitting}
        />
        
        <div className="my-4">
            {!isRecording ? (
                <button type="button" onClick={handleStartRecording} className="w-full bg-green-500 text-white p-3 rounded-md hover:bg-green-600">
                    Start Recording
                </button>
            ) : (
                <button type="button" onClick={handleStopRecording} className="w-full bg-red-500 text-white p-3 rounded-md hover:bg-red-600">
                    Stop Recording
                </button>
            )}
            {audioBlob && !isRecording && (
                <div className="mt-4">
                    <p className="text-sm font-medium">Recording ready for upload.</p>
                    <audio src={URL.createObjectURL(audioBlob)} controls className="w-full mt-2" />
                    <button onClick={() => setAudioBlob(null)} className="text-sm text-red-500 mt-1">Remove recording</button>
                </div>
            )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !selectedTeamId}
          className="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Update'}
        </button>
        {error && <p className="text-red-500 mt-4">{error}</p>}
        {!selectedTeamId && <p className="text-gray-500 mt-4">Please select a team to post an update.</p>}
      </form>
    </div>
  );
} 