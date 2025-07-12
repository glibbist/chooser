const axios = require('axios');
const fs = require('fs');
const { resolve } = require('path');
const DATA_PATH = "/data.json";

function processEntries(apiData, existingData) {
    const allGames = apiData.map(game => {
        const existingEntry = existingData.find(e => e.id === game.id);
        const yearClass = (() => {
            if (game.year < 1980) return 0;
            if (game.year <= 1997) return 1;
            return 2;
        })();

        const commonName = game.name.replace(/^The\s+/i,'');

        return {
            id: game.id,
            commonName: commonName,
            floor: existingEntry ? existingEntry.floor : 1,  // Preserve
            year: game.year,
            yearClass,
            manufacturer: game.manufacturer,
            ipdb_link: game.ipdb_link,
            ipdb_id: game.ipdb_id,
            kineticist_url: game.kineticist_url
        };    
    });

    existingData.forEach(existingGame => {
        if (!apiData.map(g=>g.id).includes(existingGame.id)) {
            allGames.push(existingGame);
        }
    });

    return allGames.sort((a,b) => a.id - b.id);
}

async function fetchGames() {
    try {
        const response = await axios.get('https://pinballmap.com/api/v1/locations/17135/machine_details.json');
        if (response.data.machines) {
            return response.data.machines;
        } else {
            throw new Error('Unable to access machine details.');
        }
    } catch(err) {
        console.error('Data Fetch Error:', err.message);
        process.exit(1); // Stop execution
    }
}

function loadPreviousData() {
    if (fs.existsSync(DATA_PATH)) {
        const contents = fs.readFileSync(DATA_PATH, 'utf8');
        return JSON.parse(contents);
    } else {
        return [];
    }
}

async function main() {
    const previousDataset = loadPreviousData();
    const fetchedGames = await fetchGames().catch(() => []);

    if (!fetchedGames || !Array.isArray(fetchedGames)) {
        process.exit(2); // Abort program
    }

    const newDataset = processEntries(fetchedGames, previousDataset);
    fs.writeFileSync(DATA_PATH,JSON.stringify(newDataset,null,2), { encoding:'utf8' });

    console.log(`Saved data: ${DATA_PATH}`);
}

main();
