"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, BellRing, ShieldCheck, FlaskConical } from "lucide-react";
import { useNavCategories } from "./useNavCategories";

const SECTION_ICON = { alerts: BellRing, access: ShieldCheck, test: FlaskConical };

/*
  ⚙ next to the bell (desktop): every "settings" category as one mega menu,
  a column per section. Shows only what the user may open; with nothing to
  show the gear is not rendered at all. On phones these sections live at the
  bottom of the ☰ menu instead (Navbar.jsx).
*/
const SettingsMenu = () => {
  const { settings, hidden } = useNavCategories();
  const pathname = usePathname()?.split("?")[0];
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (hidden || settings.length === 0) return null;

  const active = settings.some((c) => c.items.some((i) => i.path === pathname));
  const cols = Math.min(settings.length, 3);

  return (
    <div className="relative hidden md:block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="true"
        title="Settings"
        className={`rounded-full p-2 transition ${active ? "bg-green-700 text-white" : "text-gray-200 hover:bg-gray-700 hover:text-white"}`}
      >
        <Settings className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-gray-800 shadow-2xl ring-1 ring-black/20">
          <div className="flex items-center gap-2 border-b border-gray-700 px-5 py-3 text-sm font-semibold text-white">
            <Settings className="h-4 w-4 text-gray-400" />
            Settings
          </div>
          <div
            className="grid gap-x-2 p-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(12rem, 1fr))` }}
          >
            {settings.map((cat) => {
              const Icon = SECTION_ICON[cat.icon] || Settings;
              return (
                <div key={cat.category} className="min-w-0 py-1">
                  <p className="flex items-center gap-1.5 px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    <Icon className="h-3.5 w-3.5" />
                    {cat.category}
                  </p>
                  {cat.items.map((item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setOpen(false)}
                      className={`block rounded-md px-3 py-1.5 text-xs transition ${
                        item.path === pathname ? "bg-green-700 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsMenu;
