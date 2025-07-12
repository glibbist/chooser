const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://pinballmap.com/api/v1/locations/17135/machine_details.json';  // API address
const LOCAL_DATA_PATH = path.join(process.env.GITHUB_WORKSPACE, 'data.json');  // Update path as per your repo

const calculateYearAndFloor = (year) => {
  const currentYear = new Date().getFullYear();
  const yearsDifference = currentYear - year;
  const floor = Math.floor(yearsDifference / 10);
  const yearClass = year > 1980 ? floor : 1;  // Example logic; adjust based on requirement
  return { yearClass, floor };
};

const normalizeGameData = (rawGame) => ({
  ...rawGame,
  yearClass: calculateYearAndFloor(rawGame.year).yearClass,
  floor: calculateYearAndFloor(rawGame.year).floor
});

// Fetch external API
const fetchAPIJSON = async (url) => {
  try {
    const response = await axios.get(url);
    const apiGameData = response.data;
    return apiGameData.map(normalizeGameData);  // Apply calculated fields
  } catch (error) {
    throw new Error("Failed to fetch external API: " + error.toString());
  }
};

// Read local JSON, ensure exist for merge
const readLocalJSON = (filePath) => {
  if (!fs.existsSync(filePath)) throw new Error("Missing local data.json file (path)");

  const rawData = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(rawData);
};

// Merge external sources with local data
const mergeUpdateAndDelete = (externalData, localData) => {
  const localIdSet = new Set(localData.map(game => game.id));
  externalData.forEach((game) => {
    const { id, ...rest } = game;  // Separate id for comparison
    if (localIdSet.has(id)) {
      const existingLocalGame = localData.find(item => item.id === id);  // Modify in-place (better for same fields)
      Object.assign(existingLocalGame, rest);  // Merge extended/calculated fields

    } else {
      localData.push(game);  // Add new games from API not present in local
    }
  });

  // Remove any local/ids no longer in external source
  return localData.filter(game => externalData.some(ext => ext.id === game.id));
};

// Write the new combined JSON
const writeJSONFile = (filePath, data) => {
  const jsonContent = JSON.stringify(data, null, 2) + '\n';  // Pretty print + newline for clean view
  fs.writeFileSync(filePath, jsonContent, 'utf-8');
};

(async () => {
  try {
    const fetchedAPIData = await fetchAPIJSON(API_URL);
    const initialLocalData = readLocalJSON(LOCAL_DATA_PATH);
    const processedData = mergeUpdateAndDelete(fetchedAPIData, initialLocalData);

    writeJSONFile(LOCAL_DATA_PATH, processedData);
  } catch (error) {
    console.error("Final merge encountered error:", error.message);
    process.exitCode = 1;
  }
})();
