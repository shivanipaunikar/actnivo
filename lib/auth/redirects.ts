export function safeNextPath(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/app/dashboard";
  }
  return value;
}

export function messagePath(path: string, type: "error" | "success", message: string) {
  const params = new URLSearchParams({ [type]: message });
  return `${path}?${params.toString()}`;
}
