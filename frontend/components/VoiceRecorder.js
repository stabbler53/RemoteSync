// To use this component, run: npm install wavesurfer.js
import React, { useRef, useState, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";

export default function VoiceRecorder({ onRecordingComplete, maxDuration = 120 }) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [timer, setTimer] = useState(0);
  const [intervalId, setIntervalId] = useState(null);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunks = useRef([]);
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);

  useEffect(() => {
    if (audioURL && waveformRef.current) {
      if (wavesurfer.current) wavesurfer.current.destroy();
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#60a5fa",
        progressColor: "#2563eb",
        height: 48,
        barWidth: 2,
        responsive: true,
      });
      wavesurfer.current.load(audioURL);
    }
    return () => {
      if (wavesurfer.current) wavesurfer.current.destroy();
    };
  }, [audioURL]);

  const startRecording = async () => {
    setError("");
    setAudioURL(null);
    setAudioBlob(null);
    setTimer(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunks.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/wav" });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
        if (onRecordingComplete) onRecordingComplete(blob);
      };
      mediaRecorder.start();
      setRecording(true);
      setPaused(false);
      setIntervalId(setInterval(() => {
        setTimer((t) => {
          if (t + 1 >= maxDuration) {
            stopRecording();
            return t;
          }
          return t + 1;
        });
      }, 1000));
    } catch (err) {
      setError("Microphone access denied or unavailable.");
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setPaused(true);
      clearInterval(intervalId);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setPaused(false);
      setIntervalId(setInterval(() => {
        setTimer((t) => {
          if (t + 1 >= maxDuration) {
            stopRecording();
            return t;
          }
          return t + 1;
        });
      }, 1000));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setPaused(false);
      clearInterval(intervalId);
    }
  };

  const resetRecording = () => {
    setAudioURL(null);
    setAudioBlob(null);
    setTimer(0);
    setRecording(false);
    setPaused(false);
    clearInterval(intervalId);
    if (wavesurfer.current) wavesurfer.current.destroy();
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center w-full max-w-md mx-auto">
      <div className="mb-2 text-lg font-semibold">🎤 Voice Update</div>
      {audioURL ? (
        <div className="w-full flex flex-col items-center">
          <div ref={waveformRef} className="w-full my-2" />
          <audio controls src={audioURL} className="w-full my-2" />
          <div className="flex gap-2 mt-2">
            <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600" onClick={resetRecording}>Re-record</button>
          </div>
        </div>
      ) : (
        <>
          {recording && (
            <div className="w-full my-2">
              <div className="h-12 bg-blue-100 rounded animate-pulse" />
            </div>
          )}
          <div className="text-gray-700 my-2">{new Date(timer * 1000).toISOString().substr(14, 5)} / {new Date(maxDuration * 1000).toISOString().substr(14, 5)}</div>
          <div className="flex gap-2 mt-2">
            {!recording && (
              <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" onClick={startRecording}>Start Recording</button>
            )}
            {recording && !paused && (
              <button className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600" onClick={pauseRecording}>Pause</button>
            )}
            {recording && paused && (
              <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" onClick={resumeRecording}>Resume</button>
            )}
            {recording && (
              <button className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600" onClick={stopRecording}>Stop</button>
            )}
          </div>
        </>
      )}
      {error && <div className="text-red-500 mt-2">{error}</div>}
    </div>
  );
} 