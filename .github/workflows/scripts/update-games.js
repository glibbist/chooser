const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://pinballmap.com/api/v1/locations/17135/machine_details.json';
const LOCAL_DATA_PATH = path.join(process.env.GITHUB_WORKSPACE, 'data.json');  // Adjust path for local

const calculateYearAndFloor = (year) => {
  const currentYear = new Date().getFullYear();
  const yearsDiff = currentYear - year;
  const floor = Math.floor(yearsDiff / 10);
  return {
    yearClass: floor || 1,  // Set minimum
    floor: `Floor ${floor || 1}`   // Example display string format
  };
};

const normalizeGameData = (rawGame) => ({
  id: rawGame.id,
  name: rawGame.name,
  year: rawGame.year,
  manufacturer: rawGame.manufacturer,
  ...calculateYearAndFloor(rawGame.year) // Apply calculated values
});

async function fetchAPIJSON(url) {
  try {
    const { data: apiResponse } = await axios.get(url);
    
    // Validate if 'machines' array exists
    if (!apiResponse.machines || !Array.isArray(apiResponse.machines)) {
      throw new Error("API response unexpected: missing or invalid 'machines' object");
    }

    // Use the 'machines' property correctly
    return apiResponse.machines.map(normalizeGameData);

  } catch (error) {
    console.error("Failed API fetch", url, error);
    throw new Error("Failed with error: " + error.message);
  }
}

// Read existing local JSON for merging
const readLocalJSON = (filePath) => {
  if (!fs.existsSync(filePath)) throw new Error(`Missing required JSON: ${filePath}`);

  try {
    const rawContents = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(rawContents);
  } catch (error) {
    console.error("Failed to read existing JSON:", filePath);
    throw new Error("File read: " + error.message);
  }
};

// Merge process + remove
const mergeAndCleanData = function (apiGames, localGames) {
  const localGameIds = new Set(localGames.map(lg => lg.id));
  const output = [];

  apiGames.forEach(game => {
    let gameCopy;
    if (localGameIds.has(game.id)) {
      gameCopy = { ...localGames.find(lg => lg.id === game.id), ...game };
    } else {
      gameCopy = { ...game };
    }
    output.push(gameCopy);  // Combines updated/new entries
  });

  // Remove any non-API-present local games
  return output.filter(combined => apiGames.some(apiGame => apiGame.id === combined.id));
};

// Save the combined JSON
const writeJSONSync = (filePath, mergedJson) => {
  const jsonContent = JSON.stringify(mergedJson, null, 2) + '\n';
  fs.writeFileSync(filePath, jsonContent, 'utf-8');
  console.log("Data sync complete:", filePath);
};

(async () => {
  console.log("Starting Pinball API-JSON Autosync...");

  try {
    const freshApiGames = await fetchAPIJSON(API_URL);
    const prevGameData = readLocalJSON(LOCAL_DATA_PATH);

    const updatedGames = mergeAndCleanData(freshApiGames, prevGameData);
    writeJSONSync(LOCAL_DATA_PATH, updatedGames);

    console.log("Processed:", updatedGames.length, "games successfully");
  } catch (error) {
    console.error("Critique:", error.message);
    process.exitCode = 1;  // Non-zero exit indicates failure
  }
})();
