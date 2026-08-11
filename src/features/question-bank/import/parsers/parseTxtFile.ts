export async function parseTxtFile(
  file: File
): Promise<string> {
  const arrayBuffer =
    await file.arrayBuffer();

  return new TextDecoder(
    "utf-8"
  ).decode(arrayBuffer);
}