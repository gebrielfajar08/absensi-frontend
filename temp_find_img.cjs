const fs=require('fs'); const s=fs.readFileSync('src/pages/Landing.jsx','utf8'); let idx=-1; let count=0; while(true){ idx=s.indexOf('<img', idx+1); if(idx===-1) break; count++; const end=s.indexOf('>', idx); const tag=s.slice(idx, end+1); console.log('IMG',count,'idx',idx,'selfClose',/\/>\s*$/.test(tag), 'tag:', tag.replace(/\n/g,' ')); }
console.log('total',count);
