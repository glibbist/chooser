const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://pinballmap.com/api/v1/locations/17135/machine_details.json';
const LOCAL_DATA_PATH = path.join(process.env.GITHUB_WORKSPACE, 'data.json');

const calculateYearAttributes = (year) => {
  const currentYear = new Date().getFullYear();
  const yearsDifference = currentYear - year;
  const floor = Math.floor(yearsDifference / 10);
  const yearClass = year > 1980 ? floor : 1;  // Adjust this logic based on real requirements
  return { yearClass, floor };
};

const normalizeGameData = (rawGame) => ({
  id: rawGame.id,  // Ensure `id` is present
  name: rawGame.name,
  year: rawGame.year,
  ...calculateYearAttributes(rawGame.year),
  // Copy additional fields if needed
  manufacturer: rawGame.manufacturer
});

async function fetchAPIJSON(url) {
  try {
    const response = await axios.get(url);
    const apiData = response.data;

    // Validate data
    if (!Array.isArray(apiData)) {
      throw new Error("Unexpected API data format: not an array");
    }
    
    // Normalize
    return apiData.map(normalizeGameData);
    
  } catch (error) {
    console.error("Failed API request: URL:", url, "Error:", error.message);
    throw new Error("Fetch error for API JSON" + error.toString());
  }
}

function loadExistingJSON(filePath) {
  if (!fs.existsSync(filePath)) throw new Error("File missing for JSON merge");

  const rawData = fs.readFileSync(filePath, 'utf-8');
  const jsonData = JSON.parse(rawData);

  console.log("Local data loaded, count:", jsonData.length);  // Verify count
  return jsonData;
}

function syncFiles(apiData, localData) {
  const localIds = new Set(localData.map(game => game.id));
  const merged = [];

  apiData.forEach(game => {
    const { id, ...rest } = game;
    if (localIds.has(id)) {  // Update if matches
      const existingGame = localData.find(localGame => localGame.id === id);
      Object.assign(existingGame, { ...rest });
    } else { 
      localData.push(game);  // New entry (add)
    }
  });

  // Filter out removed in API source
  return localData.filter(game => apiData.some(apiGame => apiGame.id === game.id));
}

function saveCombinedJSON(filePath, data) {
  const jsonData = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, jsonData, 'utf-8');
  console.log(`Successfully written JSON to: ${filePath}`);
}

// Main execution
(async () => {
  try {
    const fetchedAPIData = await fetchAPIJSON(API_URL);
    const initialLocalData = loadExistingJSON(LOCAL_DATA_PATH);
    
    const mergedData = syncFiles(fetchedAPIData, initialLocalData);
    saveCombinedJSON(LOCAL_DATA_PATH, mergedData);
  } catch (error) {
    console.error("Final error in workflow:", error);
    process.exitCode = 1;  // Indicate failure
  }
})();
