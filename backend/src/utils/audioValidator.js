/**
 * Audio magic byte validator
 * Accepts:
 *  - WAV: starts with 'RIFF' and bytes 8..12 are 'WAVE'
 *  - WebM / Matroska: starts with 1A 45 DF A3
 *  - Ogg: starts with 'OggS' (4F 67 67 53)
 *  - MP4 / M4A: 'ftyp' at offset 4 (bytes 4..8)
 *  - MP3: starts with 'ID3' (49 44 33) or sync word (FF FB, FF F3, FF F2, FF E0..FF FF)
 */
export const validateAudioMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 12) {
    return false;
  }

  // 1. WAV
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    return true;
  }

  // 2. WebM / Matroska: 1A 45 DF A3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return true;
  }

  // 3. Ogg: OggS
  if (buffer.toString('ascii', 0, 4) === 'OggS') {
    return true;
  }

  // 4. MP4 / M4A: ftyp at offset 4
  if (buffer.toString('ascii', 4, 8) === 'ftyp') {
    return true;
  }

  // 5. MP3: ID3 or sync word
  if (buffer.toString('ascii', 0, 3) === 'ID3') {
    return true;
  }
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return true;
  }

  return false;
};
