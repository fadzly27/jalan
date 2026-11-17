// Builds the app and publishes dist/ to the gh-pages branch (GitHub Pages source).
// Usage: npm run deploy
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const sh = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const out = (cmd) => execSync(cmd).toString().trim();

const remote = out('git remote get-url origin');
const email = out('git config user.email');
const name = out('git config user.name');

sh('npx vite build');
writeFileSync('dist/.nojekyll', '');
rmSync('dist/.git', { recursive: true, force: true });

const g = (cmd) => sh(cmd, { cwd: 'dist' });
g('git init -q -b gh-pages');
g(`git -c user.email="${email}" -c user.name="${name}" add -A`);
g(`git -c user.email="${email}" -c user.name="${name}" commit -q -m "Deploy ${new Date().toISOString()}"`);
g(`git push -f -q "${remote}" gh-pages`);
rmSync('dist/.git', { recursive: true, force: true });
console.log('Published to gh-pages.');
