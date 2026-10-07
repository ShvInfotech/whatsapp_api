// Script to test WAWebMsgModel directly in WhatsApp Web page
const { MongoClient } = require('/home/mani/public_html/iot/node_modules/mongodb');
const instanceService = require('/home/mani/public_html/iot/src/services/instanceService');

(async () => {
  await instanceService.initAll();
  // Wait for instances to be ready
  await new Promise(r => setTimeout(r, 5000));

  let client = null;
  for (const [id, state] of instanceService.instances.entries()) {
    if (state.client && state.client.pupPage && state.status === 'CONNECTED') {
      client = state.client;
      console.log('Found connected instance:', id);
      break;
    }
  }

  if (!client) {
    console.log('No connected instance found');
    process.exit(1);
  }

  const result = await client.pupPage.evaluate(() => {
    try {
      const MsgModel = window.require('WAWebMsgModel').Msg;
      const testMsg = new MsgModel({
        type: 'image',
        caption: 'Hello World Caption'
      });
      return {
        hasCaption: 'caption' in testMsg,
        captionValue: testMsg.caption,
        bodyValue: testMsg.body,
        keys: Object.keys(testMsg).filter(k => k.includes('caption') || k.includes('body')),
        attributes: testMsg.attributes ? {
          caption: testMsg.attributes.caption,
          body: testMsg.attributes.body
        } : null
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  });

  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(0);
})();
