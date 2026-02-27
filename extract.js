const fs = require('fs');

const content = fs.readFileSync('fakoshop.html', 'utf8');
const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);

if (scriptMatch) {
    fs.writeFileSync('temp.js', scriptMatch[1]);
    console.log("Extracted script to temp.js");
} else {
    console.log("No script tag found");
}