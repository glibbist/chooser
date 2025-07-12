// Dependencies setup
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const WORKSPACE_PATH = process.env.GITHUB_WORKSPACE;  // Define workspace path
console.log("Workspace:", WORKSPACE_PATH);

const RAW_URL = "https://raw.githubusercontent.com/glibbist/chooser/main/dist/index.html";  // Direct path to data

// File path for saving parsed JSON
const DATA_FILE_PATH = path.join(WORKSPACE_PATH, 'data.json');

async function fetchRawHTML(url) {
    try {
        const { data } = await axios.get(url);  // Data retrieval
        return data;
    } catch (error) {
        console.error("Unable to fetch HTML", url);
        throw new Error("Fetch error: " + error.message);
    }
}

// Parse fetched HTML content to games structure
function parseHTMLtoJSON(html) {
    const gamePattern = /id="(\d+)".+?class="machine_link_full_width">(.+?)(?:<\/span>|<span class="machine_link">)(.+?)(?:<span|<div)/gsi;
    const games = [];

    let match;
    while (match = gamePattern.exec(html)) {
        const [_, id, name, year_manufacturer] = match;
        const [, year, manufacturer] = /^ (\d{4})([^<]+)/.exec(year_manufacturer) || [0, 0, 'unknown'];
        games.push({
            id: parseInt(id, 10),
            name: name.trim(),
            year: parseInt(year, 10),
            manufacturer: manufacturer.trim()
        });
    }

    return games;
}

// Save to JSON file in defined path
function saveJSON(data, filePath) {
    const dataDump = JSON.stringify(data, null, 2) + '\n';  // String format + newline
    fs.writeFileSync(filePath, dataDump, 'utf8');
    console.log("Saved data to", filePath);
}

(async () => {  // Self-executing async
    try {
        const htmlContent = await fetchRawHTML(RAW_URL);
        const gameData = parseHTMLtoJSON(htmlContent);
        saveJSON(gameData, DATA_FILE_PATH);
    } catch (globalError) {
        console.error("Script error:", globalError.message);
        process.exitCode = 1;  // Exit on failure
    }
})();
