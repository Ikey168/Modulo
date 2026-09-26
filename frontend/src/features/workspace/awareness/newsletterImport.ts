import PostalMime from 'postal-mime';
import { safeUrl, type Newsletter } from './model';

function htmlText(html: string): string {
  const template = document.createElement('template'); template.innerHTML = html;
  template.content.querySelectorAll('script,style,iframe,object').forEach(node => node.remove());
  template.content.querySelectorAll('br,p,div,li,h1,h2,h3,tr').forEach(node => node.append('\n'));
  template.content.querySelectorAll('a[href]').forEach(node => { const url = safeUrl(node.getAttribute('href') ?? ''); if (url) node.append(` (${url})`); });
  return (template.content.textContent ?? '').replace(/\n[ \t]+/g, '\n').trim();
}
export async function importNewsletter(raw: ArrayBuffer | string, fallbackTitle = 'Newsletter'): Promise<Newsletter> {
  if ((typeof raw === 'string' ? new TextEncoder().encode(raw).length : raw.byteLength) > 2000000) throw new Error('Choose an email smaller than 2 MB.');
  const email = await PostalMime.parse(raw);
  const body = (email.text || htmlText(email.html ?? '')).trim();
  if (!body) throw new Error('This email has no readable message body.');
  if (body.length > 200000) throw new Error('The message exceeds 200,000 characters. Paste a shorter version.');
  return { id: crypto.randomUUID(), title: email.subject || fallbackTitle, sender: email.from?.address || email.from?.name || '', body, url: '', receivedAt: email.date && Number.isFinite(Date.parse(email.date)) ? new Date(email.date).toISOString() : new Date().toISOString(), messageId: email.messageId ?? '', status: 'Unread' };
}
