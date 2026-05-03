import fs from 'fs';
import path from 'path';

const distDir = path.join(process.cwd(), 'dist');
const lpPath = path.join(distDir, 'lp.html');
const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(lpPath)) {
  const lpContent = fs.readFileSync(lpPath, 'utf-8');
  fs.writeFileSync(indexPath, lpContent);
  console.log('✅ Successfully replaced index.html with lp.html');
} else {
  console.error('❌ lp.html not found in dist folder');
  process.exit(1);
}
