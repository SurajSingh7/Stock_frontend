/*
  pm2 entry for `next dev` on Windows.

  `next dev` forks its server ("next-server") into a child process. Run under
  pm2 there is no console to inherit, so Windows gives that child a NEW console
  window — and closing the window kills the child, which next dev immediately
  re-forks, so the window comes straight back.

  Forcing windowsHide on every fork/spawn before Next loads keeps the child
  windowless. Next calls child_process.fork through the module object at call
  time, so patching the export here is enough. Logs still reach pm2 as before.
*/
const cp = require("child_process");

const hide = (fn) =>
  function patched(...args) {
    // fork(path, args?, options?) / spawn(cmd, args?, options?): options is the
    // last plain object, or missing.
    const last = args[args.length - 1];
    if (last && typeof last === "object" && !Array.isArray(last)) {
      args[args.length - 1] = { ...last, windowsHide: true };
    } else {
      args.push({ windowsHide: true });
    }
    return fn.apply(this, args);
  };

cp.fork = hide(cp.fork);
cp.spawn = hide(cp.spawn);

process.argv = [process.argv[0], require.resolve("next/dist/bin/next"), "dev", ...process.argv.slice(2)];
require("next/dist/bin/next");
