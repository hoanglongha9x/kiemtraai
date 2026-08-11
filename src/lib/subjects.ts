export function normalizeSubjectName(
  value: unknown
): string {
  const subject = String(
    value ?? ""
  ).trim();

  const normalized = subject
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ");

  if (
    normalized === "tin" ||
    normalized === "tin hoc"
  ) {
    return "Tin học";
  }

  return subject;
}
