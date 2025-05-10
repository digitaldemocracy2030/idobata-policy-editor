/**
 * Extracts a document name from a file path
 * @param filePath Path to the file (e.g., "docs/policies/education_dx.md")
 * @returns Document name without extension (e.g., "education_dx")
 */
export function extractDocumentName(filePath: string): string {
  if (!filePath) {
    return "ドキュメント";
  }

  const filename = filePath.split("/").pop() || "";
  const nameWithoutExtension = filename.replace(/\.md$/, "");

  return nameWithoutExtension || "ドキュメント";
}

/**
 * Creates a standardized PR title
 * @param username Name of the user making the proposal
 * @param documentName Name of the document being modified
 * @param content Brief description of changes
 * @returns Formatted PR title
 */
export function formatPrTitle(
  username: string,
  documentName: string,
  content: string
): string {
  const submitter = username || "匿名ユーザー";
  const description = content || "変更提案";
  const document = documentName || "ドキュメント";

  return `（提案者：${submitter}）${description}【${document}】`;
}
