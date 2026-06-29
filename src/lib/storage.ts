/**
 * Supabase Storage 객체 키는 ASCII만 허용한다(한글·공백 등은 InvalidKey 오류).
 * 안전한 키(UUID + 확장자)를 생성한다. 원본 파일명은 DB(file_name)에 따로 보관해
 * 표시/다운로드에 사용한다.
 */
export function safeStorageKey(prefix: string, fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = crypto.randomUUID();
  return ext ? `${prefix}/${base}.${ext}` : `${prefix}/${base}`;
}
