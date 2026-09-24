/**
 * Makes a picture somebody chose small enough to keep: the centre square, at
 * most `SIDE` pixels across, as a JPEG `data:` URL — the only thing
 * `profile_photo_write` takes. A phone's photo is several megabytes; this is a
 * few dozen kilobytes, and it is all a round mark ever needs.
 */
const SIDE = 512;
const QUALITY = 0.85;

export async function shrinkPhoto(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const out = Math.min(SIDE, side);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("no 2d context");
    }
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      out,
      out,
    );
    return canvas.toDataURL("image/jpeg", QUALITY);
  } finally {
    bitmap.close();
  }
}
