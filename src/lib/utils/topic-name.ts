export function cleanCurriculumName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function normalizeCurriculumName(name: string): string {
  return cleanCurriculumName(name).toLocaleLowerCase("vi");
}

export function cleanTopicName(name: string): string {
  return cleanCurriculumName(name);
}

export function normalizeTopicName(name: string): string {
  return normalizeCurriculumName(name);
}
