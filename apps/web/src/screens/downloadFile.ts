/**
 * Offers `text` to the user as a file download. Uses a temporary object URL and anchor click
 * because browsers have no direct "save file" API that works on tablets as well.
 */
export function downloadTextFile(fileName: string, text: string, mimeType = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** Turns a game title into a safe file name stem (no path separators or reserved characters). */
export function toFileStem(title: string): string {
  return title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'game';
}
