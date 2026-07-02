"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { usePermissions } from "@/context/PermissionContext";
import { useFilteredNav } from "./PermissionNavBuilder";
import { navCategories } from "./NavCategories";

export const Navbar = () => {
  const { permissions, userData } = usePermissions();

  let filteredCategories;

  if ((userData?.role || "").toLowerCase() === "admin") {
    filteredCategories = navCategories;
  } else {
    filteredCategories = useFilteredNav(navCategories, permissions);
  }


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
                  className={`flex items-center px-3 py-1 text-sm font-medium rounded-md ${isCategoryActive(category)
                      ? "bg-green-700 text-white"
                      : "hover:bg-gray-700"
                    }`}
                >
                  <span className="mr-1">{category.category}</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${desktopDropdown === category.category ? "rotate-180" : ""
                      }`}
                  />
                </button>
                {desktopDropdown === category.category && (
                  <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-gray-800 z-10">
                    <div className="py-1">
                      {category.items.map((item) => (
                        <Link
                          key={item.path}
                          href={item.path}
                          onClick={() => setDesktopDropdown(null)}
                        >
                          <div
                            className={`block px-4 py-2 text-xs ${isActive(item.path)
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
                  className={`flex items-center px-3 py-1 text-sm font-medium rounded-md ${isActive(category.items[0].path)
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
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${isCategoryActive(category)
                          ? "bg-green-700 text-white"
                          : "hover:bg-gray-700"
                        }`}
                      aria-expanded={mobileDropdown === category.category}
                      aria-haspopup="true"
                    >
                      <span>{category.category}</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${mobileDropdown === category.category ? "rotate-180" : ""
                          }`}
                      />
                    </button>
                    {mobileDropdown === category.category && (
                      <div className="pl-4 space-y-1 mt-1">
                        {category.items.map((item) => (
                          <Link
                            key={item.path}
                            href={item.path}
                            onClick={closeMobileMenu}
                          >
                            <div
                              className={`block px-3 py-1.5 text-xs rounded-md ${isActive(item.path)
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
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${isActive(category.items[0].path)
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
          </div>
        </div>
      )}
    </div>
  );
};
