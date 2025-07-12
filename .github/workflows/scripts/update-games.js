const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://pinballmap.com/api/v1/locations/17135/machine_details.json';  
const REPOS_PATH = path.join(process.env.GITHUB_WORKSPACE, './data.json');

function calculateYearClass(year) {
  if (year < 1980) return 0;  // Before 1980
  if (year <= 1997) return 1;  // 1980 - 1997 range
  return 2;  // 1998 and later
}

// Helper for API game normalization
const normalizeAPIGame = (rawGame) => ({
  id: rawGame.id,
  name: rawGame.name,
  year: rawGame.year,
  manufacturer: rawGame.manufacturer,
  yearClass: calculateYearClass(rawGame.year),
  floor: 1  // Default new value; modified where exists
});

// Fetch API and parse root correctly
const fetchAPIData = async (url) => {
  try {
    const { data: apiResponse } = await axios.get(url);
    if (!apiResponse.machines || !Array.isArray(apiResponse.machines)) {
      throw new Error("Missing/malformed API response");
    }

    // Correctly map through sub-array
    return apiResponse.machines.map(normalizeAPIGame);

  } catch (error) {
    throw new Error("Failed to fetch API: " + error.message);
  }
};

// Read existing JSON merge structure
const loadExistingJSON = (filePath) => {
  if (!fs.existsSync(filePath)) throw new Error(`Data file not found: ${filePath}`);

  try {
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContents);
  } catch (error) {
    throw new Error("Failed file reading/parsing: " + error.toString());
  }
};

// Smart merge with updates and persistence
const mergeAndCleanJSON = (apiEntries, localEntries) => {
  const output = [];
  const existingIds = new Set(localEntries.map(loc => loc.id));

  apiEntries.forEach(apiEntry => {
    let localMatch = localEntries.find(local => local.id === apiEntry.id);
    if (localMatch) {
      localMatch.yearClass = apiEntry.yearClass;  // Preserves existing floor but updates year class
      localMatch.name = apiEntry.name;  // Update details as per API
      localMatch.year = apiEntry.year;
      localMatch.manufacturer = apiEntry.manufacturer;

      output.push(localMatch);
    } else { 
      output.push(apiEntry);  // New entries follow defaults for 'floor'
    }
  });

  // Remove stale data
  return output.filter(outEntry => apiEntries.some(apiEntry => apiEntry.id === outEntry.id));
};

// Store final JSON content
const saveMergedJson = (filePath, mergedData) => {
  const jsonString = JSON.stringify(mergedData, null, 2) + '\n';
  fs.writeFileSync(filePath, jsonString, 'utf-8');
};

(async () => {
  try {
    const apiGames = await fetchAPIData(API_URL);
    console.log("API Games Count:", apiGames.length);

    const localGames = loadExistingJSON(REPOS_PATH);
    const cleanData = mergeAndCleanJSON(apiGames, localGames);
    saveMergedJson(REPOS_PATH, cleanData);

    console.log("Combined games synced to", REPOS_PATH);
  } catch (error) {
    console.error("Merge failed:", error.message);
    process.exitCode = 1;  // Indicate failure
  }
})();
