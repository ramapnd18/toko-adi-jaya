const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(publicDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix role checks
    content = content.replace(/session\.role !== 'admin'/g, "session.role.toLowerCase() !== 'admin'");
    content = content.replace(/session\.role !== 'kasir'/g, "session.role.toLowerCase() !== 'kasir'");
    
    // Fix dashboard links
    content = content.replace(/window\.location\.href = 'dashboard\.html';/g, "window.location.href = 'index.html';");
    content = content.replace(/window\.location\.href = 'index\.html';/g, "window.location.href = 'index.html';");
    
    fs.writeFileSync(filePath, content);
});
console.log('HTML files fixed!');
