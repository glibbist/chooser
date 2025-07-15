const axios = require('axios').default;
const fs = require('fs');
const path = require('path');

const API_URL = 'https://pinballmap.com/api/v1/locations/17135/machine_details.json';
const REPOS_JSON_PATH = path.join(process.env.GITHUB_WORKSPACE, './data.json');

const getYearClass = (year) => (
    (year < 1980) ? 0 :
    (year <= 1997) ? 1 :
    2
);

const processAPIEntry = (rawData) => {
    // Data validation and sanitization
    const id = Number(rawData.id);
    if (Number.isNaN(id) || !Number.isInteger(id) || id < 1) { throw new Error(Invalid id: $ { rawData.id})}

    const name = String(rawData.name).trim();
    if (name.length === 0) throw new Error(Invalid name: $ {
        rawData.name
    });

    const year = Number(rawData.year);
    if (isNaN(year) || !Number.isInteger(year) || year < 1900 || year > 2100) throw new Error(Invalid year: $ {
        rawData.year
    });

    const manufacturer = String(rawData.manufacturer).trim();

    const ipdbLink = (rawData.ipdb_link || '').toString();
    const ipdbId = rawData.ipdb_id !== null ? Number(rawData.ipdb_id) : null;
    if (ipdbId !== null && (isNaN(ipdbId) || !Number.isInteger(ipdbId) || ipdbId < 1)) {
        throw new Error(Invalid ipdb_id: $ {
            rawData.ipdb_id
        });
    }

    const kineticistUrl = (rawData.kineticist_url || '').toString();
    const opdbId = (rawData.opdb_id || '').toString();

    const commonName = name.replace(/^The /, '').trim();

    const yearClass = getYearClass(year);

    return {
        id: id,
        name: name,
        year: year,
        yearClass: yearClass,
        manufacturer: manufacturer,
        ipdb_link: ipdbLink,
        ipdb_id: ipdbId,
        kineticist_url: kineticistUrl,
        opdb_id: opdbId,
        commonName: commonName
    };
};

async function getApiGames(url) {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await axios.get(url);
            response.raise_for_status(); // Check for HTTP errors
            if (!response.data.machines || !Array.isArray(response.data.machines)) {
                throw new Error("API response missing 'machines' array");
            }
            return response.data.machines.map(processAPIEntry);
        } catch (error) {
            console.error(Attempt $ {
                    attempt + 1
                }
                failed: , error);
            if (attempt === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

function validateGame(game) {
    if (typeof game.id !== 'number') throw new Error(Invalid id: $ {
        game.id
    });
    if (!Number.isInteger(game.id) || game.id <= 0) throw new Error('id must be a positive integer');
    if (typeof game.name !== 'string' || game.name.trim() === '') throw new Error('name must be a non-empty string');
    if (typeof game.year !== 'number') throw new Error('year must be a number');
    if (game.year < 1900 || game.year > 2100) throw new Error('Invalid year');
    if (typeof game.manufacturer !== 'string') throw new Error('manufacturer must be a string');
    if (game.ipdb_id !== null && (!Number.isInteger(game.ipdb_id) || game.ipdb_id <= 0)) throw new Error('ipdb_id must be a positive integer or null');
    if (typeof game.floor !== 'number' || [0, 1].indexOf(game.floor) === -1) throw new Error('floor must be 0 or 1');
}

function mergeAndAdjustGames(apiEntries, localEntries) {
    const merged = [];
    const existingIds = new Set(localEntries.map(game => game.id));

    for (const apiGame of apiEntries) {
        const matchedLocal = localEntries.find(local => local.id === apiGame.id);


        if (matchedLocal) {
            merged.push({
                ...apiGame,
                floor: matchedLocal.floor
            });
        } else {
            merged.push({
                ...apiGame,
                floor: 1 // Default for new entries
            });
        }
    }

    merged.forEach(validateGame); // Validate all merged games

    const clean = merged.filter(data => apiEntries.some(api => api.id === data.id));
    return clean;
}

function loadExistingGames(filePath) {
    if (!fs.existsSync(filePath)) throw new Error(Missing JSON file: $ {
        filePath
    });

    const content = fs.readFileSync(filePath, 'utf-8');
    const games = JSON.parse(content);
    console.log(Loaded existing data: $ {
            games.length
        }
        games);
    return games;
}

function writeMergedFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(Successfully wrote to $ {
        filePath
    });
}

(async() => {
    try {
        console.log('Syncing data...');


        const apiGames = await getApiGames(API_URL);
        const localGames = loadExistingGames(REPOS_JSON_PATH);
        const mergedFinalData = mergeAndAdjustGames(apiGames, localGames);

        writeMergedFile(REPOS_JSON_PATH, mergedFinalData);

        console.log('Pinned-sync operation complete!');
    } catch (error) {
        console.error('Critical error:', error.message);
        process.exitCode = 1;
    }
})();
