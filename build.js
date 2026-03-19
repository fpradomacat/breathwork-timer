const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const terser = require('terser');
const fs = require('fs');
const path = require('path');

const dist = './dist';
if (!fs.existsSync(dist)) fs.mkdirSync(dist);

// CSS
const css = fs.readFileSync('./style.css', 'utf8');
const minCSS = new CleanCSS().minify(css).styles;
fs.writeFileSync(`${dist}/style.css`, minCSS);

// JS
const js = fs.readFileSync('./script.js', 'utf8');
terser.minify(js).then(result => {
    fs.writeFileSync(`${dist}/script.js`, result.code);
});

// HTML
const html = fs.readFileSync('./index.html', 'utf8');
minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true
}).then(result => {
    fs.writeFileSync(`${dist}/index.html`, result);
});

// Copiar MP3s
fs.readdirSync('.').filter(f => f.endsWith('.mp3')).forEach(f => {
    fs.copyFileSync(f, `${dist}/${f}`);
});

console.log('Build listo en /dist');