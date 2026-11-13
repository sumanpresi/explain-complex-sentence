import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
const dir = new URL('../', import.meta.url);
process.chdir(fileURLToPath(dir));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png'};
function chunk(type, data) {
  const content = Buffer.concat([Buffer.from(type),data]);
  let crc = -1;
  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  const length = Buffer.alloc(4), sum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); sum.writeUInt32BE((crc ^ -1) >>> 0);
  return Buffer.concat([length,content,sum]);
}
function icon(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size,0); header.writeUInt32BE(size,4); header[8] = 8; header[9] = 2;
  const stride = 1 + size * 3;
  const pixels = Buffer.alloc(size * stride);
  const segments = [[.34,.31,.34,.53],[.34,.53,.65,.53],[.54,.42,.65,.53],[.54,.64,.65,.53]];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x+.5)/size, py = (y+.5)/size;
      const lit = segments.some(([x1,y1,x2,y2]) => {
        const dx=x2-x1, dy=y2-y1;
        const t=Math.min(1,Math.max(0,((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy)));
        return Math.hypot(px-x1-t*dx,py-y1-t*dy)<.032;
      });
      const offset=y*stride+1+x*3;
      pixels.set(lit ? [227,239,199] : [24,44,39],offset);
    }
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
for (const size of [192,512]) fs.writeFileSync('public/icon-'+size+'.png',icon(size));
const assets = Object.fromEntries(fs.readdirSync('public').map(file => ['/'+file,[types[path.extname(file)],fs.readFileSync('public/'+file).toString('base64')]]));
fs.mkdirSync('dist/server',{recursive:true});
fs.copyFileSync('site-worker.mjs','dist/server/index.js');
fs.copyFileSync('lib/ai.mjs','dist/server/ai.mjs');
fs.writeFileSync('dist/server/assets.mjs','export const assets = '+JSON.stringify(assets)+';');
