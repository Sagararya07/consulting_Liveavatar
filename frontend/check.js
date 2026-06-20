const fs = require('fs');
const src = fs.readFileSync('app/admin/page.tsx', 'utf8');
const open = (src.match(/{/g) || []).length;
const close = (src.match(/}/g) || []).length;
console.log('braces:', open, '/', close, ' diff:', open - close);
console.log('has old <style>{` block:', src.includes('<style>{`'));
console.log('has dangerouslySetInnerHTML:', src.includes('dangerouslySetInnerHTML'));
console.log('Inter apostrophe present:', /font-family: 'Inter'/.test(src));
console.log('Inter entity present (should be false):', /font-family: &#x27;Inter&#x27;/.test(src));
