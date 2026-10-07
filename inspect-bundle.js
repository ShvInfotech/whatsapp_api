const https = require('https');
https.get('https://static.whatsapp.net/rsrc.php/v4iVvw4/yf/l/en_GB-j/30nqaun_zo6.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    let pos = 0;
    while (true) {
      const idx = data.indexOf('addAndSendMsgToChat', pos);
      if (idx === -1) break;
      console.log('--- At ' + idx + ' ---');
      console.log(data.substring(Math.max(0, idx - 150), idx + 250));
      pos = idx + 1;
    }
  });
});
