export function cleanTopicName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function normalizeTopicName(name: string): string {
  return cleanTopicName(name).toLocaleLowerCase("vi");
}
