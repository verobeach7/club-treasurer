// Shrinks a photo before upload: long side ≤ 1600px, JPEG q=0.85, returned as base64 (no data: prefix).
// createImageBitmap applies EXIF orientation with imageOrientation: 'from-image'.
// https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap

const MAX_SIDE = 1600;
const QUALITY = 0.85;

export interface ResizedImage {
	base64: string;
	previewUrl: string; // object URL; caller revokes
	mimeType: 'image/jpeg';
}

export async function resizeImage(file: File): Promise<ResizedImage> {
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
	const width = Math.round(bitmap.width * scale);
	const height = Math.round(bitmap.height * scale);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('canvas unavailable');
	ctx.fillStyle = '#fff'; // transparent PNGs become white, not black
	ctx.fillRect(0, 0, width, height);
	ctx.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	const blob = await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', QUALITY),
	);
	const bytes = new Uint8Array(await blob.arrayBuffer());
	let bin = '';
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return { base64: btoa(bin), previewUrl: URL.createObjectURL(blob), mimeType: 'image/jpeg' };
}
