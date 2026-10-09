// Never save a JSON error response as if it were the requested photograph.
export async function fetchAttachment(id: string, signal?: AbortSignal, download = false) {
  const response = await fetch('/api/files/' + encodeURIComponent(id) + (download ? '?download=1' : ''), {
    credentials: 'same-origin', signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'No se pudo abrir el archivo. Inténtalo nuevamente.');
  }
  const mime = response.headers.get('content-type')?.split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mime || ''))
    throw new Error('El servidor no devolvió un documento válido.');
  return response.blob();
}
export async function downloadAttachment(id: string, name: string) {
  const blob = await fetchAttachment(id, undefined, true);
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link);
  link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
