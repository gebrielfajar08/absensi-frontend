const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('src/pages/Landing.jsx', 'utf8');
const lines = code.split(/\r?\n/);
const check = (n) => {
  const slice = lines.slice(0, n).join('\n');
  try {
    parser.parse(slice, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'] });
    return true;
  } catch (e) {
    return false;
  }
};
[100,200,300,400,500,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2050,2080,2090,2095,2100,2105,2110,2115,2120,2125].forEach(n => {
  process.stdout.write(`${n}: ${check(n)}\n`);
});
