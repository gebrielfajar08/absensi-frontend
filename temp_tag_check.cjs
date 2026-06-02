const fs = require('fs');
const s = fs.readFileSync('src/pages/Landing.jsx','utf8');
let i=0; const n=s.length; const stack=[]; let line=1, col=0;
function advance() { if(s[i]==='\n'){line++;col=0;} else col++; i++; }
while(i<n){
  const ch=s[i];
  if(ch==='\n'){ advance(); continue; }
  if(ch==='<' && i+1<n && s[i+1]!=='!' && s[i+1]!=='?' ){
    // parse tag
    let j=i+1; let closing=false;
    if(s[j]==='/'){ closing=true; j++; }
    // read tagname
    while(j<n && /[\s/>]/.test(s[j]) ){
      // nothing
    }
    // Actually we need to get name: skip whitespace then capture letters
    while(j<n && /\s/.test(s[j])) j++;
    let name='';
    while(j<n && /[A-Za-z0-9:_-]/.test(s[j])){ name+=s[j]; j++; }
    if(!name){ // maybe it's something like </> or comment
      // skip
    }
    // now find closing '>' considering quotes
    let inSingle=false, inDouble=false; let selfClosing=false; let k=j;
    for(; k<n; k++){
      const c=s[k];
      if(c==='\n'){}
      if(!inSingle && !inDouble && c==="'") { inSingle=true; continue; }
      if(inSingle && c==="'") { inSingle=false; continue; }
      if(!inSingle && !inDouble && c==='"') { inDouble=true; continue; }
      if(inDouble && c==='"') { inDouble=false; continue; }
      if(!inSingle && !inDouble && c==='>') { break; }
    }
    const tagText = s.slice(i, k+1);
    // check self closing
    if(/\/>\s*$/.test(tagText)) selfClosing=true;
    if(name){
      if(closing){
        const top = stack.pop();
        if(!top){ console.log('Unmatched closing tag', name, 'at', line, col); process.exit(0); }
        if(top.name!==name){ console.log('Mismatched tag: expected', top.name, 'but got', name, 'at', line, col); process.exit(0); }
      } else if(!selfClosing){
        // push
        stack.push({name, line, col, text: tagText});
      }
    }
    // advance i to k+1
    while(i<=k) advance();
    continue;
  }
  advance();
}
if(stack.length) console.log('Unclosed tags at end, top:', stack[stack.length-1]); else console.log('All tags matched');
