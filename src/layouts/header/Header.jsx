"use client";

import React from "react";
import { Profile } from "./components/Profile";
import { Navbar } from "./components/NavBar/Navbar";
import { usePermissions } from "@/context/PermissionContext";
import ZoomButtons from "./components/zoom/ZoomButton";

const Header = () => {
    const { userData } = usePermissions();

    if (!userData) {
        return null;
    }

    return (
        <>
            <div className="h-14"></div>
            <header className="fixed top-0 left-0 w-full z-50 bg-gray-800 text-white shadow">
                <div className="flex justify-between items-center p-4 h-14">

                    {/* CLICKABLE TITLE - FULL REFRESH */}
                    <div className="flex gap-2">
                        <div
                            className="text-lg font-bold cursor-pointer hover:text-orange-300 transition"
                            onClick={() => (window.location.href = "/billing/account/pcd-closure")}
                        >
                            Netra Account
                        </div>
                        <div
                            className="text-lg font-bold cursor-pointer hover:text-orange-300 transition" >
                           <ZoomButtons variant="inline" show={1} />
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="flex-1 flex justify-center">
                            <Navbar />
                        </div>
                        <div>
                            <Profile />
                        </div>
                    </div>
                </div>
            </header>
        </>
    );
};

export default Header;
