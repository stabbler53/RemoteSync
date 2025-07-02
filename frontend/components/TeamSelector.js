'use client';

import React, { useEffect, useState } from "react";

export default function TeamSelector({ teams, selectedTeamId, onTeamChange }) {
  return (
    <select
      value={selectedTeamId}
      onChange={(e) => onTeamChange(e.target.value)}
      className="p-2 border rounded-md bg-white shadow-sm"
    >
      {teams.map(team => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  );
} 