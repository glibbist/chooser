const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Confirm Root Path
const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE;
console.log("GitHub Workspace:", GITHUB_WORKSPACE);

// Data save path
const DATA_PATH = path.join(GITHUB_WORKSPACE, 'data.json');

/** Fetch Raw Website HTML */
async function fetchHTML(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (err) {
        console.error("Unable to fetch data from:", url);
        process.exit(1);
    }
}

/** Convert HTML data to structured array */
function parseHTMLToGames(htmlString) {
    const rl = readline.createInterface({
        input: Buffer.from(htmlString, 'utf8')
    });

    const games = [];
    let currentGame = null;

    for await (const line of rl) {
        if (line.includes('class="w3-col l2 m3 s4 xs6 w3-padding wf-card"')) {
            currentGame = {};
        }

        if (currentGame) {
            const idMatch = line.match(new RegExp('<a\s+id="(.*?)"'));
            if (idMatch) {
                currentGame.id = parseInt(idMatch[1], 10);
            }

            const nameMatch = line.match(new RegExp('<span\s+class="machine_link_full_width">(.*?)</span>'));
            if (nameMatch) {
                currentGame.name = nameMatch[1].trim();
            }

            const yearMatch = line.match(/data-year="(.*?)"/);
            if (yearMatch) {
                currentGame.year = parseInt(yearMatch[1], 10);
            }

            const manufacturerMatch = line.match(new RegExp('<span\s+class="machine_link_full_width manufacture_link"(.*?)>(.*?)</span>'));
            if (manufacturerMatch || manufacturerMatch[2].includes('manufacturer_link')) {
                currentGame.manufacturer = manufacturerMatch[2].trim();
            }

            if (line.match(/>IPDB Link/i)) {
                const ipdbLinkMatch = line.match(/href="(.*?)"/);
                if (ipdbLinkMatch) {
                    currentGame.ipdb_link = ipdbLinkMatch[1];
                }
            }

            const ipdbCodeMatch = line.match(/>(IPDB:.*?)</);
            if (ipdbCodeMatch) {
                currentGame.ipdb_id = ipdbCodeMatch[1].replace('IPDB:', '').trim();
            }
        }

        if (line.includes('<div class="clearfix"></div>')) {
            if (currentGame?.id) {
                games.push(currentGame);
            }
            currentGame = {};
        }
    }
    return games;
}

/**
 * Convert games fetched into desired JSON format
 * @param {Array} games
 * @returns {Array<>: new object format
 */
function mapGamesToJSON(games) {
    return games.map(game => {
        const {
            id,
            name,
            year,
            manufacturer,
            ipdb_link,
            ipdb_id
        } = game;

        let floor = 0;   // Default
        let year_floor = Math.floor((new Date().getFullYear() - 2000 - year) / 10);
        if (year > 1979) {
            // Adjust older pinball machine allocations
            floor = year_floor > 0 ? year_floor : 1;
        }

        return {
            id: id,
            name: name,
            year: year,
            manufacturer: manufacturer,
            ipdb_link: ipdb_link,
            ipdb_id: ipdb_id,
            commonName: name,  // Simple mapping [if needed modify appropriately]
            opdb_id: `G${Math.floor(Math.random() * 800)}`, // Example logic replace as needed
            floor: floor,
            yearClass: year_floor  
        }
    });
}

/**
 * Save data to JSON
 */
function saveData(data) {
    try {
        if (!fs.existsSync(path.dirname(DATA_PATH))) {
            fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
        }
        const jsonPayload = JSON.stringify(data, null, 2) + '\n';
        fs.writeFileSync(DATA_PATH, jsonPayload);
        console.log(`Saved JSON to ${DATA_PATH}`);
    } catch (err) {
        console.error("Failed to save JSON: ", err);
        process.exit(1);
    }
}

// Main function
async function main() {
    try {
        const html = await fetchHTML("https://github.com/glibberist/chooser/blob/main/dist/index.html");
        const games = parseHTMLToGames(html);
        const formattedJSON = mapGamesToJSON(games);
        saveData(formattedJSON);
    } catch (err) {
        console.error("Script execution failed: ", err);
    }
}

// Execute main
main();
