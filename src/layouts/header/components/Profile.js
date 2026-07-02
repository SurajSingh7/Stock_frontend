"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/context/PermissionContext";
import { ChevronDown } from "lucide-react";
import { API_PORTAL_BACKEND_URL } from "@/config/getEnvVariables";
import toast from "react-hot-toast";
import ZoomButtons from "./zoom/ZoomButton";

export const Profile = () => {
  const router = useRouter();
  const { userData, clearAuthData } = usePermissions();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef();

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Logout
  const handleLogout = async () => {
    try {
      const response = await fetch(
        `${API_PORTAL_BACKEND_URL || ""}/hrms/logout`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );
      if (response.ok) {
        // clearAuthData();
        toast.success("Logged out successfully");
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };


  return (
    <div className="relative flex items-center gap-3" ref={dropdownRef}>
      {/* Greeting */}
      <span className="text-white font-bold text-sm hidden sm:inline">
        Hi, {userData?.firstName || "Guest"}! 
      </span>

      {/* Profile Image & Chevron */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 focus:outline-none"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <img
          src={userData?.profileImage || "/default-profile.png"}
          alt="Profile"
          className="w-9 h-9 rounded-full border-2 border-lime-400 object-cover shadow"
        />
        <ChevronDown className={`text-white transition-transform ${open ? "rotate-180" : ""}`} size={18} />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div
          className="
            absolute -right-4 mt-[176px] w-40 rounded-md z-40
            bg-gray-800 shadow-lg py-1
            border border-[#2d3546]
            animate-fadeIn
          "
        >
          
          <div className="px-4 py-2 border-b border-gray-700 text-white text-sm select-none">
            {userData?.employeeCode || "No employeeCode available"}
          </div>
          <div className="px-4 py-2 border-b border-gray-700 text-white text-sm select-none">
            {userData?.role || "No role available"}
          </div>

          <button
            onClick={handleLogout}
            className="
              w-full text-left px-4 py-2 text-sm text-red-500 font-bold
              hover:bg-white transition rounded-none
            "
            type="button"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
};
