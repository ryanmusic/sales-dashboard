/** Reads one line from a TTY without echoing it. */
export function promptHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return Promise.reject(new Error('stdin is not a TTY'));
  }
  return new Promise((resolve, reject) => {
    let input = '';
    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stderr.write('\n');
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          cleanup();
          resolve(input);
          return;
        }
        if (ch === '\u0003') {
          cleanup();
          reject(new Error('aborted'));
          return;
        }
        if (ch === '\u007f' || ch === '\b') {
          input = input.slice(0, -1);
        } else {
          input += ch;
        }
      }
    };
    process.stderr.write(question);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', onData);
  });
}

/** Reads stdin to EOF (for piping a password in from a secret store); strips one trailing newline. */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks)
    .toString('utf8')
    .replace(/\r?\n$/, '');
}
