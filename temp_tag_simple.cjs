const fs=require('fs'); const s=fs.readFileSync('src/pages/Landing.jsx','utf8'); const regex=/<\s*(\/)?\s*([A-Za-z0-9_-]+)/g; let match; const stack=[]; while((match=regex.exec(s))){ const isClose=!!match[1]; const name=match[2]; const idx=match.index; // find end of tag '>'
 const end = s.indexOf('>', idx); if(end===-1){ console.log('No closing > for tag', name, 'at idx', idx); break; }
 const tagText = s.slice(idx, end+1);
 const selfClosing = /\/>\s*$/.test(tagText) || tagText.endsWith('/>');
 if(isClose){ const top = stack.pop(); if(!top){ console.log('Unmatched closing',name,'at idx',idx); process.exit(0);} if(top.name!==name){ console.log('Mismatched tag: expected',top.name,'got',name,'at idx',idx,'top at',top.idx); process.exit(0);} } else if(!selfClosing){ stack.push({name,idx}); }
 }
 if(stack.length) console.log('Unclosed tags, top=',stack.slice(-5)); else console.log('All tags matched_simple');
