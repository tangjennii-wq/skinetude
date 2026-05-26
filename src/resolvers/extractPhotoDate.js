// === extractPhotoDate (Wave 1.2 extract, May 2026) ===
// Pure helper, no React state. Moved out of App so BulkPhotoUploadModal
// can live in a standalone component file. Behavior identical.

// === extractPhotoDate ===
// Best-effort EXIF DateTimeOriginal extractor for JPEGs. Returns YYYY-MM-DD string or
// null if it can't read the metadata. Used by bulk upload so the user doesn't have to
// manually date every photo. Falls back to file.lastModified at the call site.
// Implementation parses just enough of the JPEG container to find the APP1 segment
// and walks the TIFF IFDs to find tag 0x9003 (DateTimeOriginal) inside the EXIF SubIFD.
const extractPhotoDate = async (file) => {
  if (!file || !/^image\/jpe?g$/i.test(file.type || '')) return null;
  try {
    // Read first 256KB — EXIF almost always sits in the first APP1 segment near the start.
    const slice = file.slice(0, Math.min(file.size, 256 * 1024));
    const buf = await slice.arrayBuffer();
    const view = new DataView(buf);
    // SOI must be 0xFFD8
    if (view.getUint16(0) !== 0xFFD8) return null;
    let off = 2;
    // Walk markers to find APP1 (0xFFE1) with "Exif\0\0" signature
    while (off < view.byteLength - 4) {
      if (view.getUint8(off) !== 0xFF) return null;
      const marker = view.getUint16(off);
      const segLen = view.getUint16(off + 2);
      if (marker === 0xFFE1) {
        // Check for "Exif\0\0" right after the length bytes
        const sigStart = off + 4;
        if (sigStart + 6 > view.byteLength) return null;
        const sig = String.fromCharCode(view.getUint8(sigStart), view.getUint8(sigStart + 1), view.getUint8(sigStart + 2), view.getUint8(sigStart + 3));
        if (sig !== 'Exif') { off += 2 + segLen; continue; }
        const tiffStart = sigStart + 6;
        // Byte order
        const bo = view.getUint16(tiffStart);
        const le = bo === 0x4949;
        const u16 = (o) => le ? view.getUint16(o, true) : view.getUint16(o);
        const u32 = (o) => le ? view.getUint32(o, true) : view.getUint32(o);
        if (u16(tiffStart + 2) !== 0x002A) return null;
        const ifd0Off = tiffStart + u32(tiffStart + 4);
        const readDateAt = (entryStart) => {
          const count = u32(entryStart + 4);
          const valOff = u32(entryStart + 8);
          // ASCII strings: tiffStart + valOff
          const strStart = tiffStart + valOff;
          if (strStart + count > view.byteLength) return null;
          let s = '';
          for (let k = 0; k < count - 1; k++) s += String.fromCharCode(view.getUint8(strStart + k));
          return s;
        };
        // Walk IFD0 to find EXIF SubIFD pointer (tag 0x8769)
        const numIFD0 = u16(ifd0Off);
        let exifIFDOff = null;
        for (let i = 0; i < numIFD0; i++) {
          const e = ifd0Off + 2 + i * 12;
          const tag = u16(e);
          if (tag === 0x8769) { exifIFDOff = tiffStart + u32(e + 8); break; }
        }
        if (!exifIFDOff) return null;
        const numExif = u16(exifIFDOff);
        for (let i = 0; i < numExif; i++) {
          const e = exifIFDOff + 2 + i * 12;
          const tag = u16(e);
          if (tag === 0x9003) {
            // DateTimeOriginal — "YYYY:MM:DD HH:MM:SS"
            const s = readDateAt(e);
            if (!s) return null;
            const m = s.match(/^(\d{4}):(\d{2}):(\d{2})/);
            return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
          }
        }
        return null;
      }
      if (marker === 0xFFD8 || marker === 0xFFD9) return null;
      off += 2 + segLen;
    }
    return null;
  } catch (e) {
    console.warn('[extractPhotoDate] parse failed:', e);
    return null;
  }
};
