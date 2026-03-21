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

    // ── tutorial.js — minify + obfuscate ──
    const tutorialJs = fs.readFileSync('./tutorial.js', 'utf8');
    const tutorialResult = await minifyJS(tutorialJs, {
        compress: {
            drop_console: true,
            passes: 3,
        },
        mangle: {
            toplevel: true,
            properties: false,
        },
        format: {
            comments: false,
        },
    });
    fs.writeFileSync(`${dist}/tutorial.js`, tutorialResult.code);
    console.log('✓ tutorial.js');

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

    // ── Assets (sounds, images, etc.) ──
    function copyDirRecursive(src, dest) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(entry => {
            const srcPath  = `${src}/${entry}`;
            const destPath = `${dest}/${entry}`;
            if (fs.statSync(srcPath).isDirectory()) {
                copyDirRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        });
    }
    if (fs.existsSync('./assets')) {
        copyDirRecursive('./assets', `${dist}/assets`);
        console.log('✓ assets/');
    }

    console.log('\n🎉 Build listo en /dist');
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});