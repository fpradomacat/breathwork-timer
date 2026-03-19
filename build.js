const { minify: minifyHTML } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: minifyJS } = require('terser');
const fs = require('fs');

const dist = './dist';
if (!fs.existsSync(dist)) fs.mkdirSync(dist);

async function build() {

    // ── CSS ──
    const css = fs.readFileSync('./style.css', 'utf8');
    const minCSS = new CleanCSS({ level: 2 }).minify(css).styles;
    fs.writeFileSync(`${dist}/style.css`, minCSS);
    console.log('✓ style.css');

    // ── JS — minify + obfuscate ──
    const js = fs.readFileSync('./script.js', 'utf8');
    const result = await minifyJS(js, {
        compress: {
            drop_console: true,      // remove console.log calls
            passes: 3,
        },
        mangle: {
            toplevel: true,          // rename top-level vars/functions
            properties: false,       // don't mangle object properties (breaks DOM)
        },
        format: {
            comments: false,         // strip all comments
        },
    });
    fs.writeFileSync(`${dist}/script.js`, result.code);
    console.log('✓ script.js');

    // ── HTML ──
    const html = fs.readFileSync('./index.html', 'utf8');
    const minHTML = await minifyHTML(html, {
        collapseWhitespace: true,
        removeComments: true,
        removeAttributeQuotes: true,
        minifyCSS: true,
        minifyJS: true,
    });
    fs.writeFileSync(`${dist}/index.html`, minHTML);
    console.log('✓ index.html');

    // ── MP3s ──
    fs.readdirSync('.').filter(f => f.endsWith('.mp3')).forEach(f => {
        fs.copyFileSync(f, `${dist}/${f}`);
        console.log(`✓ ${f}`);
    });

    console.log('\n🎉 Build listo en /dist');
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});