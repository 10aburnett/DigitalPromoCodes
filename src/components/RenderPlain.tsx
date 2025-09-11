// src/components/RenderPlain.tsx
export default function RenderPlain({ text }: { text: string }) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  return <div className="prose max-w-none whitespace-break-spaces">{escaped}</div>;
}