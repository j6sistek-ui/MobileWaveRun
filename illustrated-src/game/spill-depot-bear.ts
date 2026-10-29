/** Owner-supplied 6 × 6 landing marshal sheet. Keep the source intact;
 * decode its white matte once and anchor every frame to the bear's feet. */
export type DepotBearFrame = { image: HTMLCanvasElement; footX: number; footY: number };

export function prepareDepotBear(sheet: HTMLImageElement): DepotBearFrame[] {
  const width = sheet.naturalWidth || sheet.width, height = sheet.naturalHeight || sheet.height;
  const frames: DepotBearFrame[] = [];
  for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
    const sx = Math.floor(col * width / 6), sy = Math.floor(row * height / 6);
    const sw = Math.floor((col + 1) * width / 6) - sx, sh = Math.floor((row + 1) * height / 6) - sy;
    const image = document.createElement("canvas"); image.width = Math.ceil(width / 6); image.height = Math.ceil(height / 6);
    const ctx = image.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
    const pixels = ctx.getImageData(0, 0, image.width, image.height), data = pixels.data;
    const W = image.width, H = image.height, seen = new Uint8Array(W * H), queue = new Int32Array(W * H);
    let read = 0, write = 0;
    const visit = (p: number) => {
      if (seen[p]) return;
      seen[p] = 1;
      const i = p * 4, low = Math.min(data[i], data[i + 1], data[i + 2]), high = Math.max(data[i], data[i + 1], data[i + 2]);
      if (!data[i + 3] || (low >= 236 && high - low <= 24)) queue[write++] = p;
    };
    for (let x = 0; x < W; x++) { visit(x); visit((H - 1) * W + x); }
    for (let y = 1; y < H - 1; y++) { visit(y * W); visit(y * W + W - 1); }
    while (read < write) {
      const p = queue[read++], x = p % W, y = Math.floor(p / W); data[p * 4 + 3] = 0;
      if (x) visit(p - 1); if (x + 1 < W) visit(p + 1);
      if (y) visit(p - W); if (y + 1 < H) visit(p + W);
    }
    // Crossed batons enclose small pockets of the original white backdrop.
    // Only substantial near-pure-white islands qualify; isolated highlights stay.
    const islands = new Uint8Array(W * H), island = new Int32Array(W * H);
    for (let start = 0; start < W * H; start++) {
      if (islands[start] || !data[start * 4 + 3]) continue;
      let count = 0, cursor = 0;
      const add = (p: number) => {
        if (islands[p]) return; islands[p] = 1;
        const i = p * 4, low = Math.min(data[i], data[i + 1], data[i + 2]);
        if (data[i + 3] && low >= 249 && Math.max(data[i], data[i + 1], data[i + 2]) - low <= 8) island[count++] = p;
      };
      add(start);
      while (cursor < count) {
        const p = island[cursor++], x = p % W, y = Math.floor(p / W);
        if (x) add(p - 1); if (x + 1 < W) add(p + 1);
        if (y) add(p - W); if (y + 1 < H) add(p + W);
      }
      if (count < 48) continue;
      read = write = 0;
      for (let i = 0; i < count; i++) visit(island[i]);
      while (read < write) {
        const p = queue[read++], x = p % W, y = Math.floor(p / W); data[p * 4 + 3] = 0;
        if (x) visit(p - 1); if (x + 1 < W) visit(p + 1);
        if (y) visit(p - W); if (y + 1 < H) visit(p + W);
      }
    }
    // Unmatte the one-pixel silhouette against its darker inner neighbor.
    // This removes the JPEG's white fringe without eroding the suit or fur.
    const original = data.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x, i = p * 4;
      if (!original[i + 3]) continue;
      const low = Math.min(original[i], original[i + 1], original[i + 2]);
      let edge = false, inner = low;
      for (const n of [p - W, p + W, p - 1, p + 1, p - W - 1, p - W + 1, p + W - 1, p + W + 1]) {
        const j = n * 4;
        if (!original[j + 3]) edge = true;
        else inner = Math.min(inner, original[j], original[j + 1], original[j + 2]);
      }
      if (!edge || low - inner < 10) continue;
      const alpha = Math.max(.15, Math.min(1, (255 - low) / Math.max(1, 255 - inner)));
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, (original[i + c] - 255 * (1 - alpha)) / alpha);
      data[i + 3] = Math.round(255 * alpha);
    }
    let left = W, right = 0, bottom = 0;
    for (let y = Math.floor(H * .65); y < H; y++) for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] < 128) continue;
      left = Math.min(left, x); right = Math.max(right, x); bottom = Math.max(bottom, y + 1);
    }
    ctx.putImageData(pixels, 0, 0);
    frames.push({ image, footX: left < right ? (left + right) / 2 : W / 2, footY: bottom || H });
  }
  return frames;
}
