// Evaluate the transformed code with React mocked, see if anything throws
const fs = require('fs');
const babel = require('@babel/core');
const vm = require('vm');

const html = fs.readFileSync('/sessions/optimistic-magical-davinci/mnt/TangSkin/index.html', 'utf8');
const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
const code = m[1];

const transformed = babel.transformSync(code, {
  presets: ['@babel/preset-react'],
  filename: 'index.jsx',
}).code;

// Mock environment
const noop = () => {};
const mockHook = (init) => [typeof init === 'function' ? init() : init, noop];
const mockEffect = noop;
const mockRef = (init) => ({ current: init });

const mockReact = {
  useState: mockHook,
  useEffect: mockEffect,
  useRef: mockRef,
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  Fragment: 'Fragment',
  createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
};
const mockReactDOM = { createRoot: () => ({ render: noop }) };

const mockLucide = new Proxy({}, { get: () => noop });
const mockSupabase = { createClient: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }) }, from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }), storage: { from: () => ({}) } }) };

const sandbox = {
  React: mockReact,
  ReactDOM: mockReactDOM,
  lucide: mockLucide,
  supabase: mockSupabase,
  document: {
    getElementById: () => ({ innerHTML: '', style: {}, appendChild: noop, addEventListener: noop, removeEventListener: noop }),
    createElement: () => ({ style: {}, classList: { add: noop, remove: noop }, addEventListener: noop, appendChild: noop }),
    body: { appendChild: noop, classList: { add: noop, remove: noop } },
    addEventListener: noop,
    removeEventListener: noop,
    querySelectorAll: () => [],
  },
  window: {
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop, clear: noop },
    navigator: { userAgent: 'jsdom' },
    location: { hash: '' },
  },
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  fetch: () => Promise.resolve({ ok: false, json: async () => ({}), text: async () => '' }),
};
sandbox.localStorage = sandbox.window.localStorage;

try {
  vm.createContext(sandbox);
  vm.runInContext(transformed, sandbox, { timeout: 5000 });
  console.log('eval OK');
} catch (e) {
  console.log('eval ERROR:', e.message);
  console.log(e.stack?.slice(0, 800));
}
