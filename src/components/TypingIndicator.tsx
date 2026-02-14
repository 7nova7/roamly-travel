export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-typing-dot" />
      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-typing-dot" style={{ animationDelay: "0.2s" }} />
      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-typing-dot" style={{ animationDelay: "0.4s" }} />
    </div>
  );
}
