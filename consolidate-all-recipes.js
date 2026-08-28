import fs from 'fs';
import path from 'path';

const toolDir = process.env.TEMP + '/claude/c--src-kidzi-GitHub-FoodEnvy/b395501e-8eaa-4f4e-aeaf-0a1ffe41d438/tool-results';

// Files that contain recipe JSON arrays (extracted from agent outputs)
const files = [
  'toolu_01Lpy9Xay5WLDMWQafGZ9WfQ.json',  // Elena: 50
  'toolu_01NKM8VKysFhNC3odQApTm16.json',  // Jamie: 50
  'toolu_01EMXvV3ePuRavnE41zPamc4.json',  // Priya: 40
  'toolu_01GhSxrZdoUu1Miv23mN8QhH.json',  // Theo: 35
  'toolu_01RVo6bZS3cwb5B1rKj63gem.json',  // Devon: 38
  'toolu_0189kj96TS5PLErfZ5BUfKto.json',  // Sofia: 35-40
  'toolu_01DstRFsa1pFSGBkWJF9fpQR.json',  // Grace: 35-40
  'toolu_01JjEx9UZ7BNiN2rYBWD8GGc.json',  // Miguel: 35-40
  'toolu_01R45Vb7Moyk3htuASaXzmfS.json',  // Ben: 30-40
  'toolu_013tEumHtjwnQi55ut8g22xm.json'   // Lucia: 30-40
];

let allRecipes = [];
let count = 0;

for (const file of files) {
  const filePath = path.join(toolDir, file);
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠ ${file} not found`);
      continue;
    }
    
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!raw[0] || raw[0].type !== 'text') continue;
    
    const text = raw[0].text;
    const match = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (!match) {
      console.log(`⚠ No JSON array found in ${file}`);
      continue;
    }
    
    const recipes = JSON.parse(match[0]);
    allRecipes = allRecipes.concat(recipes);
    console.log(`✓ ${file}: ${recipes.length} recipes`);
    count += recipes.length;
  } catch (e) {
    console.log(`✗ ${file}: ${e.message.slice(0,50)}`);
  }
}

// Add existing 40 recipes
try {
  const existing = JSON.parse(fs.readFileSync('./foodenvy-complete-recipes.json', 'utf8'));
  const arr = Array.isArray(existing) ? existing : [];
  console.log(`✓ Existing: ${arr.length} recipes`);
  const names = new Set(allRecipes.map(r => r.name));
  arr.forEach(r => {
    if (!names.has(r.name)) allRecipes.unshift(r);
  });
} catch (e) {
  console.log('No existing recipes');
}

console.log(`\n=== TOTAL: ${allRecipes.length} recipes ===`);
fs.writeFileSync('./public/foodenvy-complete-recipes.json', JSON.stringify(allRecipes, null, 2));
fs.writeFileSync('./src/domain/foodenvy-all-recipes.json', JSON.stringify(allRecipes, null, 2));
console.log('Written to public/ and src/domain/');
