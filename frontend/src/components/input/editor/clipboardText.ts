import type {Fragment, Node as ProseMirrorNode, Slice} from '@tiptap/pm/model'

const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])

function inlineText(node: ProseMirrorNode): string {
	return node.textBetween(0, node.content.size, '\n', leaf => {
		const spec = leaf.type.spec as {leafText?: (n: ProseMirrorNode) => string}
		if (spec.leafText) {
			return spec.leafText(leaf)
		}
		if (leaf.type.name === 'hardBreak') {
			return '\n'
		}
		return leaf.isText ? (leaf.text ?? '') : ''
	})
}

function serializeBlocks(fragment: Fragment, indent: string): string[] {
	const lines: string[] = []
	fragment.forEach(node => {
		lines.push(...serializeBlock(node, indent))
	})
	return lines
}

function serializeList(list: ProseMirrorNode, indent: string): string[] {
	const lines: string[] = []
	const start = typeof list.attrs.start === 'number' ? list.attrs.start : 1
	let index = 0
	list.forEach(item => {
		let marker = '- '
		if (list.type.name === 'orderedList') {
			marker = `${start + index}. `
		} else if (list.type.name === 'taskList') {
			marker = item.attrs.checked ? '- [x] ' : '- [ ] '
		}
		index++

		const childIndent = indent + ' '.repeat(marker.length)
		const itemLines = serializeBlocks(item.content, childIndent)
		if (itemLines.length === 0) {
			lines.push(indent + marker.trimEnd())
			return
		}
		// The first line gets the marker instead of the plain indentation.
		lines.push(indent + marker + itemLines[0].slice(childIndent.length))
		lines.push(...itemLines.slice(1))
	})
	return lines
}

function serializeBlock(node: ProseMirrorNode, indent: string): string[] {
	if (LIST_TYPES.has(node.type.name)) {
		return serializeList(node, indent)
	}
	if (node.isTextblock) {
		return inlineText(node).split('\n').map(line => indent + line)
	}
	if (node.isInline) {
		return [indent + (node.isText ? (node.text ?? '') : '')]
	}
	if (node.isLeaf) {
		return []
	}
	return serializeBlocks(node.content, indent)
}

/**
 * Serializes a copied slice to plain text, keeping markdown-like list markers
 * so lists survive when pasted into plain-text targets.
 */
export function serializeSliceAsText(slice: Slice): string {
	const content = slice.content
	// Pure inline selections (within a single paragraph) have no blocks to walk.
	let hasBlocks = false
	content.forEach(node => {
		if (node.isBlock) {
			hasBlocks = true
		}
	})
	if (!hasBlocks) {
		return content.textBetween(0, content.size, '\n', leaf => leaf.isText ? (leaf.text ?? '') : (leaf.type.name === 'hardBreak' ? '\n' : ''))
	}
	return serializeBlocks(content, '').map(line => line.trimEnd()).join('\n')
}
