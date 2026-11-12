import { BadRequestException } from '@nestjs/common';

export function decodeCommunityImage(value: string): { data: Buffer; mime: string } {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new BadRequestException('Use a PNG, JPEG or WebP image.');
  const data = Buffer.from(match[2], 'base64');
  if (data.length < 16 || data.length > 524288) throw new BadRequestException('Each image must be 512 KB or smaller.');
  const valid = match[1] === 'image/png'
    ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && data.subarray(-8, -4).toString() === 'IEND'
    : match[1] === 'image/jpeg'
      ? data[0] === 255 && data[1] === 216 && data[2] === 255 && data[data.length - 2] === 255 && data[data.length - 1] === 217
      : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP' && data.readUInt32LE(4) === data.length - 8;
  if (!valid) throw new BadRequestException('The image contents do not match its file type.');
  return { data, mime: match[1] };
}
