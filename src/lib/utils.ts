export function inTag(tag: string, content: string) {
	return `&lt;${tag}&gt;<${tag}>${content}</${tag}>&lt;/${tag}&gt;`;
}

export function inTagRaw(tag: string, content: string) {
	return `<${tag}>${content}</${tag}>`;
}

export function downloadBlob(blob: Blob, name: string) {
  const data = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = data;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(data);
}