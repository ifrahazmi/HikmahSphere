/**
 * @jest-environment node
 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const SW_BOOTSTRAP_PATH = path.join(__dirname, '..', '..', 'public', 'sw-bootstrap.js');

const loadSwBootstrap = () => {
  const code = fs.readFileSync(SW_BOOTSTRAP_PATH, 'utf8');
  const context = {
    self: {},
    caches: {
      keys: async () => [],
      open: async () => ({
        match: async () => undefined,
        put: async () => undefined,
      }),
      delete: async () => true,
    },
    fetch: async () => ({ ok: false }),
    console,
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.self;
};

describe('sw-bootstrap helpers', () => {
  it('matches bootstrap asset paths from manifest list', () => {
    const sw = loadSwBootstrap();
    const urls = ['/index.html', '/static/js/main.abc.js'];
    expect(sw.isBootstrapAssetUrl('/index.html', urls)).toBe(true);
    expect(sw.isBootstrapAssetUrl('/static/js/main.abc.js', urls)).toBe(true);
    expect(sw.isBootstrapAssetUrl('/online-check.txt', urls)).toBe(false);
  });

  it('prunes old bootstrap caches', async () => {
    const deleted = [];
    const context = {
      self: {},
      caches: {
        keys: async () => ['hikmahsphere-bootstrap-v0', 'hikmahsphere-bootstrap-v1', 'other'],
        delete: async (key) => {
          deleted.push(key);
          return true;
        },
      },
      console,
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(SW_BOOTSTRAP_PATH, 'utf8'), context);
    const removed = await context.self.pruneBootstrapCaches('hikmahsphere-bootstrap-v1');
    expect(removed).toEqual(['hikmahsphere-bootstrap-v0']);
    expect(deleted).toEqual(['hikmahsphere-bootstrap-v0']);
  });
});
