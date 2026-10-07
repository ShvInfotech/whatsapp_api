const fs = require('fs');
const html = fs.readFileSync('public/user.html', 'utf8');
const lines = html.split('\n');
lines.forEach((l, i) => {
  if (l.includes('data-user-tab=') || l.includes('class="user-tab-panel')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
