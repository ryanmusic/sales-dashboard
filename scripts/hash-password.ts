// Usage: yarn hash-password   (hidden prompt, or pipe the password on stdin). Prints only the bcrypt hash,
// for ADMIN_PASS_HASH or a USERS entry.
import { hashPassword, validateNewPassword } from '../server/lib/credentials.js';
import { promptHidden, readStdin } from './lib/prompt.js';

async function main() {
  let password: string;
  if (process.stdin.isTTY) {
    password = await promptHidden('New password: ');
    if ((await promptHidden('Repeat password: ')) !== password) throw new Error('passwords do not match');
  } else {
    password = await readStdin();
  }
  const problem = validateNewPassword(password);
  if (problem) throw new Error(problem);
  process.stdout.write(`${await hashPassword(password)}\n`);
}

main().catch((err) => {
  process.stderr.write(`hash-password: ${err.message}\n`);
  process.exit(1);
});
