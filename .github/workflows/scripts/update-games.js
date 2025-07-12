const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.resolve(__dirname, '../data.json');

function loadExistingData() {
    if (fs.existsSync(DATA_PATH)) {
        const existing = fs.readFileSync(DATA_PATH, 'utf8');
        return JSON.parse(existing);
    }
    return [];
}

async function fetchGames() {
    try {
        const response = await axios.get('https://pinballmap.com/api/v1/locations/17135/machine_details.json');
        if (response.status !== 200 || !response.data.machines) {
            throw new Error('Failed to fetch data');
        }
        return response.data.machines;
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

function processGameData(inputGames,existingData) {
    const allGames = inputGames.map(game => {
        const existingEntry = existingData.find(e => e.id === game.id);
        const yearClass = (() => {
            if (game.year < 1980) return 0;
            if (game.year <= 1997) return 1;
            return 2;
        })();
        
        // Common name with 'The ' removal
        const commonName = game.name.replace(/^The\s+/i,'');
        
        return {
            id: game.id,
            name: game.name,
            year: game.year,
            manufacturer: game.manufacturer,
            ipdb_link: game.ipdb_link,
            ipdb_id: game.ipdb_id,
            kineticist_url: game.kineticist_url,
            opdb_id: game.opdb_id,
            commonName,  // Set commonName here
            floor: existingEntry ? existingEntry.floor : 1, // Preserve floor if exists, otherwise 1
            yearClass  // Calculate new
        };
    });

    existingData.forEach(game => {
        if (!allGames.find(g => g.id === game.id)) {
            allGames.push(game);
        }
    });

    allGames.sort((a,b) => a.id - b.id); // Sort by id
    return allGames;
}

async function main(){
    const inputGames = await fetchGames();
    const existingData = loadExistingData();
    const combinedData = processGameData(inputGames,existingData);

    fs.writeFileSync(DATA_PATH, JSON.stringify(combinedData,null,2));
}

main();
