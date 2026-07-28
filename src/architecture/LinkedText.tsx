import React from 'react';

// Matches the `[[slug|display text]]` inline topic-link marker the wiki-content generation
// pipeline emits — the `|display text` part is optional and falls back to the slug itself.
const TOPIC_LINK_PATTERN = /\[\[([\w-]+)(?:\|([^\]]+))?\]\]/g;

interface LinkedTextProps {
  text: string;
  onSelectTopic: (slug: string) => void;
}

// Renders free-text wiki content (descriptions, overviews, feature bullets, topic sections) with
// any `[[slug|text]]` markers turned into clickable in-app navigation — a <button>, not an <a>,
// since this is an app navigation action rather than a URL (matching the convention already used
// elsewhere in this codebase for click-driven, non-href navigation).
const LinkedText: React.FC<LinkedTextProps> = ({ text, onSelectTopic }) => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  TOPIC_LINK_PATTERN.lastIndex = 0;
  while ((match = TOPIC_LINK_PATTERN.exec(text)) !== null) {
    const [full, slug, display] = match;
    if (match.index > lastIndex) {
      parts.push(<React.Fragment key={key++}>{text.slice(lastIndex, match.index)}</React.Fragment>);
    }
    parts.push(
      <button
        key={key++}
        className="arch-inline-topic-link"
        onClick={() => onSelectTopic(slug)}
      >
        {display ?? slug}
      </button>
    );
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    parts.push(<React.Fragment key={key++}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return <>{parts}</>;
};

export default LinkedText;
