import { deflateSync, crc32 } from 'node:zlib';

export type Rgb = readonly [number, number, number];

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// A plain PNG with a vertical gradient: enough to show real-looking images in a demo, no binary asset in Git.
export function gradientPng(width: number, height: number, top: Rgb, bottom: Rgb): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);

  const rowLength = 1 + width * 3;
  const pixels = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    const ratio = height === 1 ? 0 : y / (height - 1);
    const color = top.map((channel, index) => Math.round(channel + ((bottom[index] ?? channel) - channel) * ratio));
    const row = y * rowLength;
    for (let x = 0; x < width; x += 1) {
      pixels.set(color, row + 1 + x * 3);
    }
  }

  return Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, checksum]);
}
