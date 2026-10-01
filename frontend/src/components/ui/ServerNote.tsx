import { createElement, type ReactNode } from 'react';

export function notePreview(note: string): string {
  return (
    note
      .split('\n')
      .find((line) => line.trim())
      ?.replace(/^#{1,6}\s+/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1') ?? ''
  );
}

// Render note Markdown as React text nodes; embedded HTML is never evaluated.
export function ServerNote({ note }: { note: string }) {
  const inline = (text: string): ReactNode[] =>
    text
      .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
      .filter(Boolean)
      .map((part, i) =>
        part.startsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : part.startsWith('`') ? (
          <code
            key={i}
            style={{
              fontSize: '0.95em',
              background: 'var(--hub-bg-2)',
              borderRadius: 3,
              padding: '1px 3px',
            }}
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      );
  const blocks: ReactNode[] = [];
  const lines = note.split('\n');
  for (let i = 0; i < lines.length; ) {
    if (!lines[i].trim()) {
      i++;
      continue;
    }
    const heading = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push(
        <div
          key={blocks.length}
          role="heading"
          aria-level={heading[1].length}
          style={{ fontWeight: 600, margin: '8px 0 4px' }}
        >
          {inline(heading[2])}
        </div>,
      );
      i++;
      continue;
    }
    if (/^\s*(?:[-*+]\s+|\d+\.\s+)(.+)$/.test(lines[i])) {
      const ordered = /^\s*\d+\./.test(lines[i]);
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const match = lines[i].match(ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/);
        if (!match) break;
        items.push(
          <li key={items.length} style={{ marginBottom: 3 }}>
            {inline(match[1])}
          </li>,
        );
        i++;
      }
      blocks.push(
        createElement(
          ordered ? 'ol' : 'ul',
          {
            key: blocks.length,
            style: {
              margin: '4px 0 10px',
              paddingLeft: 20,
              listStyleType: ordered ? 'decimal' : 'disc',
            },
          },
          items,
        ),
      );
      continue;
    }
    const paragraph = [lines[i++]];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(?:#{1,6}\s|[-*+]\s|\d+\.\s)/.test(lines[i])
    )
      paragraph.push(lines[i++]);
    blocks.push(
      <p key={blocks.length} style={{ margin: '4px 0 10px', whiteSpace: 'pre-wrap' }}>
        {inline(paragraph.join('\n'))}
      </p>,
    );
  }
  return <>{blocks}</>;
}
