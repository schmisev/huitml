export function inTag(tag: string, content: string) {
	return `&lt;${tag}&gt;<${tag}>${content}</${tag}>&lt;/${tag}&gt;`;
}

export function inTagRaw(tag: string, content: string) {
	return `<${tag}>${content}</${tag}>`;
}
