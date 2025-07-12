const axios = require('axios');
const fs = require('fs');

function loadExistingData() {
    if (fs.existsSync('data.json')) {
        const existing = fs.readFileSync('data.json', 'utf8');
        return JSON.parse(existing);
    } else {
        return [];
    }
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
        
        // Create Common Name
        const commonName = game.name.replace(/^The\s+/,'').replace(/(\(Gold\)|\s\(\d{4}\))/g,'').replace(/\s\(Pro\)|\s\(LE\)|\s\(Premium\)/,'');
        
        // Merge data
        return {
            id: game.id,
            name: game.name,
            year: game.year,
            manufacturer: game.manufacturer,
            ipdb_link: game.ipdb_link,
            ipdb_id: game.ipdb_id,
            kineticist_url: game.kineticist_url,
            opdb_id: game.opdb_id,
            commonName,
            floor: (existingEntry ? existingEntry.floor : 1), // Keep existing floor or default to 1
            yearClass, // Calculate only if new entry
        };
    });

    // Remove games no longer present in API request
    existingData.forEach(game => {
        if (!allGames.find(g => g.id === game.id)) {
            allGames.push(game);
        }
    });

    return allGames;
}

async function main(){
    // Get fresh data & existing data
    const inputGames = await fetchGames();
    const existingData = loadExistingData();

    // Sync datasets
    const combinedData = processGameData(inputGames,existingData);
    combinedData.sort((a,b) => a.id > b.id ? 1 : a.id === b.id ? 0 : -1);

    fs.writeFileSync(
        'data.json', 
        JSON.stringify(combinedData,null,2)
    );  
}

main();
