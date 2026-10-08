const fs=require('fs');
const s=fs.readFileSync('D:/NODE JS/whatsapp_api/scratch/wa_js/6.js','utf8');
const i = s.indexOf('__d("WAWebBaseModel"');
console.log('idx', i);
const seg = s.slice(i, i+30000);
for (const t of ['toJSON','serialize=', 'prop=function', 'session=function', 'toJSON=']) {
  let p = 0, c = 0;
  while ((p = seg.indexOf(t, p)) !== -1 && c < 5) { console.log('\n== '+t+' @'+(i+p)); console.log(seg.slice(Math.max(0,p-250), p+700).replace(/\s+/g,' ')); p += t.length; c++; }
}
