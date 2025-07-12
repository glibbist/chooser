const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://pinballmap.com/api/v1/locations/17135/machine_details.json';

// Path to repo's JSON
const DATA_PATH = path.join(process.env.GITHUB_WORKSPACE, './data.json');

// Improved yearClass calculation
const getYearClass = (year) => (
  (year < 1980) ? 0
   : (year <= 1997) ? 1
   : 2
);

// Parse API game properties
const normalizeAPIEntry = (entry) => ({
  id: entry.id,
  name: entry.name,
  year: entry.year,
  manufacturer: entry.manufacturer,
  ipdb_link: entry.ipdb_link,                   // Ensure these keys remain/merged
  ipdb_id: entry.ipdb_id,
  kineticist_url: entry.kineticist_url,
  opdb_id: entry.opdb_id,
  
  // Calculated values
  yearClass: getYearClass(entry.year),
  
  // Default floor on API; local retains these values
  floor: entry.floor === undefined ? 1 : entry.floor,

  // Process common name from 'name' attribute
  commonName: entry.name.replace(/^The /, '')   // Remove leading "The "
});

// Fetch + validate API response
async function fetchData(url) {
  const response = await axios.get(url);
  if (!response.data.machines || !Array.isArray(response.data.machines)) {
    throw new Error('Malformed API Response: Missing/Invalid "machines"');
  }
  
  return response.data.machines.map(normalizeAPIEntry);  // Map all game properties
}

// Read existing file and handle any missing content
const loadExistingGames = (path) => {
  if (!fs.existsSync(path)) throw new Error(`Missing JSON file: ${path}`);

  const content = fs.readFileSync(path, 'utf-8');
  return JSON.parse(content);
};

// Merge with API data (existing and new entries)
const syncGames = (apiGames, localGames) => {
  const outputArray = [];
  const apiIds = new Set(apiGames.map(game => game.id));

  for (let localGame of localGames) {
    const match = apiGames.find(item => item.id === localGame.id);
    if (match) {
      // Clone (original structure/floor stay same; yearClass updates)
      outputArray.push({
        ...localGame,
        ...match,
        yearClass: match.yearClass,  // Force yearClass update
        commonName: match.commonName,  // Apply updated common name
      });

    } else if (apiIds.has(localGame.id)) {
      const apiMatch = apiGames.find(item => item.id === localGame.id);
      if (apiMatch) outputArray.push(apiMatch);  // New API entries (no overwrite)
    }
  }

  // Remove any ids not in active API list but present in local
  for (let apiGame of apiGames) {
    let existing = outputArray.find(item => item.id === apiGame.id);
    if (!existing) {
      outputArray.push(apiGame);  // Append (merged, full list/all props preserved)
    }
  }

  return outputArray;
};

// Write completed JSON file
const writeGameData = (path, data) => fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');

// Final execution
(async () => {
  try {
    console.log('Synchronizing Pinball Machines from API...');
  
    // Execute core sync logic
    const apiGames = await fetchData(API_URL);
    const localGames = loadExistingGames(DATA_PATH);
    const mergedData = syncGames(apiGames, localGames);
    console.log('Merged result:', mergedData.length);
  
    // Commit saved result
    writeGameData(DATA_PATH, mergedData);
    console.log(`Successfully written to ${DATA_PATH}`);

  } catch (error) {
    console.error('Critical error', error.message);
    process.exitCode = 1;
  }
})();
