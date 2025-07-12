const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Log environment verification
console.log("GitHub Workspace:", process.env.GITHUB_WORKSPACE);

const DATA_PATH = path.join(process.env.GITHUB_WORKSPACE, 'data.json');

/** Fetch HTML and return parsed string */
async function fetchHTML(url) {
    try {
        const { data } = await axios.get(url);
        return data;
    } catch (err) {
        console.error("Failed to fetch URL:", url, "Error:", err);
        process.exit(1);  // Terminate script if no data
    }
}

/** Parse HTML to JSON games */
function parseHTMLToGames(html) {
    const games = [];
    const lines = html.split("\n");  // Split by line to read sequentially

    let currentGame = null;

    for (const line of lines) {

        if (line.includes('class="w3-col l2 m3 s4 xs6 w3-padding wf-card"')) {
            currentGame = {};
        }

        if (currentGame) {
            // ID fetch
            const idMatch = line.match('<a id="(\\d+)">');
            if (idMatch) currentGame.id = parseInt(idMatch[1]);

            // Name match
            const nameMatch = line.match('<span class="machine_link_full_width">(.+?)</span>');
            if (nameMatch) currentGame.name = nameMatch[1].trim();

            // Year match
            const yearMatch = line.match('data-year="(\\d{4})"');
            if (yearMatch) currentGame.year = parseInt(yearMatch[1]);

            // Manufacturer
            const manuMatch = line.match('<span class="machine_link_full_width manufacture_link">(.+?)</span>');
            if (manuMatch) currentGame.manufacturer = manuMatch[1].trim();

            // IPDB Link
            const ipdbMatch = line.match('<a href="(.+?)">IPDB Link</a>');
            if (ipdbMatch) currentGame.ipdb_link = ipdbMatch[1];

            // IPDB Code
            const ipdbCodeMatch = line.match('title="IPDB: (.+?)"');
            if (ipdbCodeMatch) currentGame.ipdb_id = ipdbCodeMatch[1].trim();
        }

        if (line.includes('<div class="clearfix"></div>')) {
            if (currentGame && currentGame.id) games.push(currentGame);
            currentGame = null;  // Reset for new game
        }
    }

    return games;
}

/** Map games to JSON format */
function mapGamesToJSON(games) {
    return games.map((game) => {
        const { id, name, year, manufacturer, ipdb_link, ipdb_id } = game;
        const floorScore = Math.floor((new Date().getFullYear() - 2000 - year) / 10);
        return {
            ...game,
            floor: floorScore > 0 ? floorScore : 1,
            floorName: `Floor ${floorScore > 0 ? floorScore : ""}`
        };
    });
}

/** Save JSON to filesystem */
function saveData(data) {
    if (!fs.existsSync(path.dirname(DATA_PATH))) {  // Ensure directory exists (should already via GH Actions checkout)
        fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    }

    // Writing JSON: 2 space indentation, newline
    fs.writeFileSync(
        DATA_PATH,
        JSON.stringify(data, null, 2) + '\n'
    );

    console.log(`Saved JSON data to ${DATA_PATH}`);
}

// Main execution
async function main() {
    try {
        const html = await fetchHTML("https://github.com/glibberist/chooser/blob/main/dist/index.html");
        const games = parseHTMLToGames(html);
        const formattedGames = mapGamesToJSON(games);
        saveData(formattedGames);
    } catch (err) {
        console.error("Main execution error:", err);
        process.exit(1);
    }
}

// Execute when script initializes
if (!module.parent) {
    main();
}
