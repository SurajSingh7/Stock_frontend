"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Menu,
  X,
  Settings,
  Package,
  Inbox,
  ArrowLeftRight,
  LayoutGrid,
} from "lucide-react";
import { useNavCategories } from "./useNavCategories";

const SECTION_ICON = {
  stock: Package,
  requests: Inbox,
  transfer: ArrowLeftRight,
};

/* A grouped menu (Inventory = Inventory + Requests + Transfer): one column per
   member category, its name as the column heading.

   It opens under its button, left-aligned. A wide panel under a button near
   the right of the bar would run off the screen, so once it is laid out it
   measures itself and slides left by exactly the overflow (8px margin), and
   never past the left edge. Done on the element, before paint — no flicker. */
const EDGE = 8;
const GroupPanel = ({ category, isActive, onPick }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    const rect = el.getBoundingClientRect();
    let shift = 0;
    if (rect.right > window.innerWidth - EDGE)
      shift = window.innerWidth - EDGE - rect.right;
    if (rect.left + shift < EDGE) shift = EDGE - rect.left;
    el.style.transform = shift ? `translateX(${shift}px)` : "";
  }, []);
  return (
    <div
      ref={ref}
      className="absolute left-0 z-10 mt-2 grid max-w-[calc(100vw-1rem)] gap-x-2 overflow-x-auto rounded-xl bg-gray-800 p-3 shadow-2xl ring-1 ring-black/20"
      style={{
        gridTemplateColumns: `repeat(${category.sections.length}, minmax(11rem, 1fr))`,
      }}
    >
      {category.sections.map((section) => {
        const Icon = SECTION_ICON[section.icon] || LayoutGrid;
        return (
          <div key={section.category} className="min-w-0 py-1">
            <p className="flex items-center gap-1.5 px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <Icon className="h-3.5 w-3.5" />
              {section.category}
            </p>
            {section.items.map((item) => (
              <Link key={item.path} href={item.path} onClick={onPick}>
                <div
                  className={`block rounded-md px-3 py-1.5 text-xs ${isActive(item.path) ? "bg-green-700 text-white" : "text-gray-300 hover:bg-gray-700"}`}
                >
                  {item.name}
                </div>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export const Navbar = () => {
  // Permission filtering (and the admin bypass) lives in useNavCategories.
  // "Settings" categories are not in the bar: on desktop they sit under the
  // ⚙ next to the bell (SettingsMenu), on phones at the end of this ☰ menu.
  const {
    main: filteredCategories,
    settings: settingsCategories,
    hidden,
  } = useNavCategories();

  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopDropdown, setDesktopDropdown] = useState(null);
  const [mobileDropdown, setMobileDropdown] = useState(null);
  const navRef = useRef();

  useEffect(() => {
    if (!desktopDropdown) return;
    const handleClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setDesktopDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [desktopDropdown]);

  const isActive = (path) => {
    const currentPath = pathname?.split("?")[0];
    return currentPath === path;
  };

  const isCategoryActive = (category) => {
    return category.items.some((item) => isActive(item.path));
  };

  const toggleDesktopDropdown = (category) => {
    setDesktopDropdown(desktopDropdown === category ? null : category);
  };

  const toggleMobileDropdown = (category) => {
    setMobileDropdown(mobileDropdown === category ? null : category);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setMobileDropdown(null);
  };

  // No branch, no navigation. Every destination behind these links renders the
  // "no branch assigned" screen instead (see PermissionGuard), so offering them
  // would only be an invitation to click around and keep hitting the same wall.
  // The profile menu stays, which is where Logout already lives.
  // `loading` is excluded so the nav does not blink out on every page load, and
  // `error` so a failed permissions fetch is not mistaken for a missing branch.
  if (hidden) return null;

  return (
    <div>
      {/* Desktop Navigation */}
      <nav ref={navRef} className="hidden md:flex space-x-1">
        {filteredCategories.map((category) => (
          <div key={category.category} className="relative">
            {category.items.length > 0 ? (
              <>
                <button
                  onClick={() => toggleDesktopDropdown(category.category)}
                  aria-expanded={desktopDropdown === category.category}
                  aria-haspopup="true"
                  className={`flex items-center px-3 py-1 text-sm font-medium rounded-md ${
                    isCategoryActive(category)
                      ? "bg-green-700 text-white"
                      : "hover:bg-gray-700"
                  }`}
                >
                  <span className="mr-1">{category.category}</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${
                      desktopDropdown === category.category ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {desktopDropdown === category.category && category.sections && (
                  <GroupPanel
                    category={category}
                    isActive={isActive}
                    onPick={() => setDesktopDropdown(null)}
                  />
                )}
                {desktopDropdown === category.category &&
                  !category.sections && (
                    <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-gray-800 z-10">
                      <div className="py-1">
                        {category.items.map((item) => (
                          <Link
                            key={item.path}
                            href={item.path}
                            onClick={() => setDesktopDropdown(null)}
                          >
                            <div
                              className={`block px-4 py-2 text-xs ${
                                isActive(item.path)
                                  ? "bg-green-700 text-white"
                                  : "text-gray-300 hover:bg-gray-700"
                              }`}
                            >
                              {item.name}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            ) : (
              <Link key={category.items[0].path} href={category.items[0].path}>
                <div
                  className={`flex items-center px-3 py-1 text-sm font-medium rounded-md ${
                    isActive(category.items[0].path)
                      ? "bg-green-700 text-white"
                      : "text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {category.items[0].name}
                </div>
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Mobile Toggle Button */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-md bg-gray-800"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute right-0 mt-[0.3px] w-64 bg-gray-800 shadow-lg z-20 top-14">
          <div className="px-4 py-3 space-y-1">
            {filteredCategories.map((category) => (
              <div key={category.category} className="py-1">
                {category.items.length > 1 ? (
                  <>
                    <button
                      onClick={() => toggleMobileDropdown(category.category)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                        isCategoryActive(category)
                          ? "bg-green-700 text-white"
                          : "hover:bg-gray-700"
                      }`}
                      aria-expanded={mobileDropdown === category.category}
                      aria-haspopup="true"
                    >
                      <span>{category.category}</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${
                          mobileDropdown === category.category
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                    </button>
                    {mobileDropdown === category.category &&
                      category.sections && (
                        <div className="pl-4 mt-1 space-y-2">
                          {category.sections.map((section) => (
                            <div key={section.category}>
                              <p className="px-3 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                {section.category}
                              </p>
                              {section.items.map((item) => (
                                <Link
                                  key={item.path}
                                  href={item.path}
                                  onClick={closeMobileMenu}
                                >
                                  <div
                                    className={`block px-3 py-1.5 text-xs rounded-md ${isActive(item.path) ? "bg-green-700 text-white" : "text-gray-300 hover:bg-gray-700"}`}
                                  >
                                    {item.name}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    {mobileDropdown === category.category &&
                      !category.sections && (
                        <div className="pl-4 space-y-1 mt-1">
                          {category.items.map((item) => (
                            <Link
                              key={item.path}
                              href={item.path}
                              onClick={closeMobileMenu}
                            >
                              <div
                                className={`block px-3 py-1.5 text-xs rounded-md ${
                                  isActive(item.path)
                                    ? "bg-green-700 text-white"
                                    : "text-gray-300 hover:bg-gray-700"
                                }`}
                              >
                                {item.name}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                  </>
                ) : (
                  <Link
                    key={category.items[0].path}
                    href={category.items[0].path}
                    onClick={closeMobileMenu}
                  >
                    <div
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                        isActive(category.items[0].path)
                          ? "bg-green-700 text-white"
                          : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      {category.items[0].name}
                    </div>
                  </Link>
                )}
              </div>
            ))}

            {settingsCategories.length > 0 && (
              <div className="border-t border-gray-700 pt-2">
                <button
                  onClick={() => toggleMobileDropdown("__settings")}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                    settingsCategories.some(isCategoryActive)
                      ? "bg-green-700 text-white"
                      : "hover:bg-gray-700"
                  }`}
                  aria-expanded={mobileDropdown === "__settings"}
                  aria-haspopup="true"
                >
                  <span className="flex items-center gap-2">
                    <Settings size={16} />
                    Settings
                  </span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${mobileDropdown === "__settings" ? "rotate-180" : ""}`}
                  />
                </button>
                {mobileDropdown === "__settings" && (
                  <div className="pl-4 mt-1 space-y-2">
                    {settingsCategories.map((category) => (
                      <div key={category.category}>
                        <p className="px-3 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          {category.category}
                        </p>
                        {category.items.map((item) => (
                          <Link
                            key={item.path}
                            href={item.path}
                            onClick={closeMobileMenu}
                          >
                            <div
                              className={`block px-3 py-1.5 text-xs rounded-md ${
                                isActive(item.path)
                                  ? "bg-green-700 text-white"
                                  : "text-gray-300 hover:bg-gray-700"
                              }`}
                            >
                              {item.name}
                            </div>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
