const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://pinballmap.com/api/v1/locations/17135/machine_details.json';
const REPOS_JSON_PATH = path.join(process.env.GITHUB_WORKSPACE, './data.json');

const getYearClass = (year) => (
  (year < 1980) ? 0
  : (year <= 1997) ? 1
  : 2
);

const processAPIEntry = (rawData) => ({
  id: rawData.id,
  name: rawData.name,
  year: rawData.year,
  manufacturer: rawData.manufacturer,
  ipdb_link: rawData.ipdb_link,
  ipdb_id: rawData.ipdb_id,
  kineticist_url: rawData.kineticist_url,
  opdb_id: rawData.opdb_id,
  commonName: rawData.name.replace(/^The /, ''),
  yearClass: getYearClass(rawData.year)
  // No `floor` here, will inherit from local if matched
});

// Fetch + validation
async function getApiGames(url) {
  const response = await axios.get(url);
  if (!response.data.machines || !Array.isArray(response.data.machines)) {
    throw new Error("API: No 'machines' array present");
  }

  return response.data.machines.map(processAPIEntry);
}

// Read existing file
const loadExistingGames = (filePath) => {
  if (!fs.existsSync(filePath)) throw new Error(`Missing JSON file: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const games = JSON.parse(content);
  console.log(`Loaded existing data: ${games.length} games`);
  return games;
};

// Merge logic
const mergeAndAdjustGames = (apiEntries, localEntries) => {
  const merged = [];
  const existingIds = new Set(localEntries.map(game => game.id));

  for (let apiGame of apiEntries) {
    const matchedLocal = localEntries.find(local => local.id === apiGame.id);
    
    if (matchedLocal) {
      // Combine API updates & existing attributes (merge)
      merged.push({
        id: apiGame.id,
        name: apiGame.name,
        year: apiGame.year,
        yearClass: apiGame.yearClass,  // Updated
        commonName: apiGame.commonName,
        manufacturer: apiGame.manufacturer,
        ipdb_link: apiGame.ipdb_link,
        ipdb_id: apiGame.ipdb_id,
        kineticist_url: apiGame.kineticist_url,
        opdb_id: apiGame.opdb_id,
        floor: matchedLocal.floor,  // Preserve local 'floor'
      });
      
    } else {
      // Non-existing (new additions)
      merged.push({
        ...apiGame,
        floor: 1  // Default for new entries
      });
    }
  }
  
  // Cleanup non-present ids in API + remove old/deprecated
  const clean = merged.filter(data => apiEntries.some(api => api.id === data.id));

  console.log(`Merged output: ${clean.length} games`);
  return clean;
};

// Write combined file
const writeMergedFile = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`Successfully wrote to ${filePath}`);
};

// Final execution
(async () => {
  try {
    console.log('Syncing data...');

    const apiGames = await getApiGames(API_URL);
    const localGames = loadExistingGames(REPOS_JSON_PATH);
    const mergedFinalData = mergeAndAdjustGames(apiGames, localGames);
  
    writeMergedFile(REPOS_JSON_PATH, mergedFinalData);

    console.log('Pinned-sync operation complete!');
  } catch (error) {
    console.error('Critical error: ', error);
    process.exitCode = 1;
  }
})();
