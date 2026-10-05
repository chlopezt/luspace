declare const __LUSPACE_BUILD_ID__: string;
const resumeKey = 'luspace:pdf-resume', guardKey = 'luspace:pdf-reload';
const ttl = 10 * 60 * 1000;
export type PdfResume = { actor: string; child: string; selected: string[]; photo: boolean; at: number };
export class PdfModuleError extends Error {
  constructor() { super('No se pudo cargar el generador PDF. Revisa tu conexión y recarga la página para intentarlo nuevamente.'); }
}
export function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .* failed|ChunkLoadError|Unable to preload CSS/i.test(message);
}
export async function loadPdfModule<T>(load: () => Promise<T>): Promise<T> {
  try { return await load(); }
  catch (error) {
    if (!isChunkLoadError(error)) throw error;
    // A transient request may succeed on retry. A cached failed module still
    // requires the guarded deployment recovery below.
    await new Promise(resolve => setTimeout(resolve, 400));
    try { return await load(); }
    catch (retryError) { if (isChunkLoadError(retryError)) throw new PdfModuleError(); throw retryError; }
  }
}
export function takePdfResume(): PdfResume | null {
  try {
    const raw = sessionStorage.getItem(resumeKey); sessionStorage.removeItem(resumeKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (typeof value.actor !== 'string' || typeof value.child !== 'string' || !Array.isArray(value.selected) ||
      !value.selected.every((v: unknown) => typeof v === 'string') || typeof value.photo !== 'boolean' ||
      !Number.isFinite(value.at) || Date.now() - value.at > ttl) return null;
    return value;
  } catch { return null; }
}
export async function recoverPdfDeployment(resume: Omit<PdfResume, 'at'>, safeToReload: () => boolean) {
  if (!navigator.onLine || !safeToReload()) return false;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch('/app-version.json', { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return false;
    const { version } = await response.json();
    if (typeof version !== 'string' || version === __LUSPACE_BUILD_ID__ || !safeToReload()) return false;
    const at = Date.now(), prior = JSON.parse(sessionStorage.getItem(guardKey) || 'null');
    if (prior?.version === version && at - prior.at < ttl) return false;
    // Only navigation settings are kept; never persist the report payload,
    // photograph, diagnosis, draft or other clinical content in browser storage.
    sessionStorage.setItem(resumeKey, JSON.stringify({ ...resume, at }));
    sessionStorage.setItem(guardKey, JSON.stringify({ version, at }));
    location.reload(); return true;
  } catch { return false; }
  finally { clearTimeout(timer); }
}
