// server-safe plain renderer (no hooks, no client)
export function RenderPlainServer({ text }: { text: string }) {
  return <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{text}</pre>;
}
