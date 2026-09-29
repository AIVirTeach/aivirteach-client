export function TypingIndicator() {
  return (
    <div className="typing-indicator" role="status">
      <span />
      <span />
      <span />
      {/* Live regions announce text content, not aria-label. A <p> so the dot rule (`.typing-indicator span`) skips it. */}
      <p className="sr-only">AI teacher is responding</p>
    </div>
  );
}
