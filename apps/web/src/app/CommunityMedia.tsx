import { useEffect, useId, useState, type ReactElement } from 'react';
import { api, type CommunityGroup, type CommunityMediaInput } from '../lib/api';

export function CommunityImage({ accessToken, group, kind = 'logo' }: { accessToken: string; group: CommunityGroup; kind?: 'logo' | 'qr' }): ReactElement {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  const exists = kind === 'logo' ? group.hasLogo : group.hasQr;
  useEffect(() => {
    let active = true;
    setSrc(''); setFailed(false);
    if (exists) void api.communityImage(accessToken, group.id, kind).then((image) => { if (active) setSrc(image.dataUrl); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [accessToken, exists, group.id, group.mediaVersion, kind]);
  if (kind === 'qr') return src ? <img className="community-qr" src={src} alt={`QR code for ${group.name}`} onError={() => { setSrc(''); setFailed(true); }} /> : <p role="status">{failed ? 'QR image could not be loaded. Close and reopen to retry.' : 'Loading QR image…'}</p>;
  return src ? <img className="community-logo" src={src} alt={`${group.name} logo`} onError={() => setSrc('')} /> : <span className="community-logo community-logo--default" role="img" aria-label="Default community logo">♧</span>;
}

export async function readCommunityImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use a PNG, JPEG or WebP image.');
  if (file.size > 524288 || file.size < 16) throw new Error('Each image must be 512 KB or smaller.');
  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('The image could not be read.')); reader.readAsDataURL(file); });
  await new Promise<void>((resolve, reject) => { const image = new Image(); image.onload = () => image.width && image.height && image.width <= 8192 && image.height <= 8192 ? resolve() : reject(new Error('Choose an image no larger than 8192 × 8192 pixels.')); image.onerror = () => reject(new Error('The image is damaged or unsupported.')); image.src = dataUrl; });
  return dataUrl;
}

export function CommunityMediaFields({ value, onChange, disabled = false, existing }: { value: CommunityMediaInput; onChange: (value: CommunityMediaInput) => void; disabled?: boolean; existing?: CommunityGroup }): ReactElement {
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const hintId = useId();
  return <fieldset className="community-media-fields" disabled={disabled || reading}><legend>Community images <small>(optional)</small></legend><p id={hintId}>PNG, JPEG or WebP · up to 512 KB each. QR images appear only when opened.</p>
    <div>{(['logo', 'qr'] as const).map((kind) => <label key={kind}>{kind === 'logo' ? 'Community logo' : 'QR-code image'}<input type="file" accept="image/png,image/jpeg,image/webp" aria-describedby={hintId} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; event.target.value = ''; setError(''); setReading(true); void readCommunityImage(file).then((data) => onChange({ ...value, [kind]: data })).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Image could not be read.')).finally(() => setReading(false)); }} />{value[kind] && <img className="community-upload-preview" src={value[kind]!} alt={`Selected ${kind} preview`} />}{(value[kind] || (existing && (kind === 'logo' ? existing.hasLogo : existing.hasQr) && value[kind] !== null)) && <button type="button" className="quiet-button" onClick={() => onChange({ ...value, [kind]: null })}>Remove {kind === 'logo' ? 'logo' : 'QR image'}</button>}{value[kind] === null && <small>Image will be removed on save.</small>}</label>)}</div>
    <label>QR purpose / caption<input maxLength={240} value={value.qrCaption ?? ''} onChange={(event) => onChange({ ...value, qrCaption: event.target.value })} placeholder="e.g. Volunteer registration details" /></label>
    {reading && <p role="status">Checking image…</p>}{error && <p role="alert" className="form-error">{error}</p>}
  </fieldset>;
}
