const axios = require('axios');
const fs = require('fs');

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

function processGame(game) {
    const yearClass = (() => {
        if (game.year < 1980) return 0;
        if (game.year <= 1997) return 1;
        return 2;
    })();

    return {
        id: game.id,
        name: game.name.replace(/(\d{4})\s|\s\(\w+\)/g, ''), // Remove (year) or (model) etc. 
        year: game.year,
        manufacturer: game.manufacturer,
        ipdb_link: game.ipdb_link,
        ipdb_id: game.ipdb_id,
        kineticist_url: game.kineticist_url,
        opdb_id: game.opdb_id,
        commonName: game.name,
        floor: 1, // default to floor 1 for new items
        yearClass
    };
}

async function main() {
    const fetchedGames = await fetchGames();
    fs.writeFileSync(
        'data.json',
        JSON.stringify(fetchedGames.map(game => processGame(game)), null, 2)
    );
}

main();
