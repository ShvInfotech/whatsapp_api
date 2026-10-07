const https = require('https');
https.get('https://static.whatsapp.net/rsrc.php/v4iVvw4/yf/l/en_GB-j/30nqaun_zo6.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const start = 3092200;
    console.log(data.substring(start, start + 3000));
  });
});
