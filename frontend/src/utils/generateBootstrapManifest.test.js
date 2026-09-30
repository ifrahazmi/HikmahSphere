const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

describe('generate-bootstrap-manifest', () => {
  it('includes main bundles and startup images', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-bootstrap-'));
    const buildDir = path.join(tmp, 'build');
    const publicDir = path.join(tmp, 'public');
    fs.mkdirSync(buildDir, { recursive: true });
    fs.mkdirSync(publicDir, { recursive: true });

    fs.writeFileSync(
      path.join(buildDir, 'asset-manifest.json'),
      JSON.stringify({
        files: {
          'main.css': '/static/css/main.abc.css',
          'main.js': '/static/js/main.def.js',
          'runtime-main.js': '/static/js/runtime-main.ghi.js',
        },
        entrypoints: [
          'static/js/runtime-main.ghi.js',
          'static/css/main.abc.css',
          'static/js/main.def.js',
        ],
      })
    );

    fs.writeFileSync(
      path.join(publicDir, 'index.html'),
      '<link rel="apple-touch-startup-image" href="/apple-splash-750-1334.png"/>'
    );

    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'generate-bootstrap-manifest.js');
    const script = fs.readFileSync(scriptPath, 'utf8')
      .replace(
        "const BUILD_DIR = path.join(__dirname, '..', 'build');",
        `const BUILD_DIR = '${buildDir.replace(/\\/g, '/')}';`
      )
      .replace(
        "const PUBLIC_INDEX = path.join(__dirname, '..', 'public', 'index.html');",
        `const PUBLIC_INDEX = '${path.join(publicDir, 'index.html').replace(/\\/g, '/')}';`
      )
      .replace(
        "const OUTPUT = path.join(BUILD_DIR, 'bootstrap-manifest.json');",
        'const OUTPUT = path.join(BUILD_DIR, \'bootstrap-manifest.json\');'
      );

    const runner = path.join(tmp, 'run-manifest.js');
    fs.writeFileSync(runner, script);
    execSync(`node "${runner}"`, { stdio: 'pipe' });

    const output = JSON.parse(fs.readFileSync(path.join(buildDir, 'bootstrap-manifest.json'), 'utf8'));
    expect(output.version).toBe('v1');
    expect(output.urls).toContain('/static/js/main.def.js');
    expect(output.urls).toContain('/static/css/main.abc.css');
    expect(output.urls).toContain('/logo.png');
    expect(output.urls).toContain('/apple-splash-750-1334.png');
  });
});
