'use client'
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Sun, Moon, LineChart, Users, Network, Store, Wifi, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_PORTAL_BACKEND_URL } from '@/config/getEnvVariables';
// import ForgotPasswordNotice from '@/component/common/modal/ForgotPasswordNotice';

const LoginComponent = () => {
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [theme, setTheme] = useState('light');

    // Load saved credentials from localStorage
    useEffect(() => {
        const savedUsername = localStorage.getItem("username");
        const savedPassword = localStorage.getItem("password");
        const savedRememberMe = localStorage.getItem("rememberMe") === "true";

        if (savedRememberMe) {
            setUsername(savedUsername || "");
            setPassword(savedPassword || "");
            setRememberMe(savedRememberMe);
        }
    }, []);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const handleLogin = async (event, forceReplace = false) => {
        event.preventDefault();

        if (!username || !password) {
            toast.error("Username and password are required");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_PORTAL_BACKEND_URL}/hrms/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({ username, password, forceReplace }),
            });

            const result = await response.json();

            if (response.ok) {
                if (result.key === "redir-to-broken") {
                    window.location.href = "/error/server-error";
                    return;
                }

                if (result.success) {
                    if (rememberMe) {
                        localStorage.setItem("username", username);
                        localStorage.setItem("password", password);
                        localStorage.setItem("rememberMe", "true");
                    } else {
                        localStorage.removeItem("username");
                        localStorage.removeItem("password");
                        localStorage.removeItem("rememberMe");
                    }

                    toast.success(result.message);
                    window.location.href = "/home";
                } else {
                    toast.error(result.message || "Login failed");
                }
            } else {
                // 🔥 Handle login limit
                if (result.message?.includes("Login limit")) {
                    if (window.confirm(`${result.message} Do you want to replace one device?`)) {
                        handleLogin(event, true); // retry with forceReplace
                        return;
                    }
                }

                toast.error(result.message || "Login failed");
            }
        } catch (err) {
            toast.error("Something went wrong");
            console.error("Login Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const features = [
        { icon: <Users className="w-6 h-6 text-orange-500" />, title: 'HRMS' },
        { icon: <Store className="w-6 h-6 text-blue-500" />, title: 'Stock' },
        { icon: <LineChart className="w-6 h-6 text-orange-500" />, title: 'Sales' },
        { icon: <Wifi className="w-6 h-6 text-blue-500" />, title: 'NOC' },
        { icon: <Briefcase className="w-6 h-6 text-orange-500" />, title: 'CRM' },
        { icon: <Network className="w-6 h-6 text-gray-600" />, title: 'Network' },
    ];

    return (
        <>
            <div
                className={`min-h-screen flex items-center justify-center p-4 font-[poppins] relative
                    bg-gradient-to-br
                    ${theme === 'light'
                        ? 'from-[#fdf6ee] to-[#f0f6fe]'
                        : 'from-[#000000] to-[#000000]'
                    }`}
            >

                {/* Theme Toggle */}
                {/* <button
                    onClick={toggleTheme}
                    className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        : 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700'
                        }`}
                >
                    {theme === 'light' ? (
                        <Moon className="w-4 h-4" />
                    ) : (
                        <Sun className="w-4 h-4" />
                    )}
                    <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
                </button> */}

                {/* Main Container - Optimized for laptop screens */}
                <div className="w-full max-w-5xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center min-h-[calc(100vh-2rem)]">
                        {/* Left Section - Company Info & Features */}
                        <div className={`space-y-8  ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                            <div
                                className="
                                absolute 
                                top-1 sm:top-6 md:top-8 lg:top-2 xl:top-1 2xl:top-2 
                                left-4 sm:left-6 md:left-8 lg:left-10 xl:left-10 2xl:left-16
                                "
                            >
                                <img
                                    src="/netra.svg"
                                    alt="NETRA Logo"
                                    className="
                                    w-16        /* base: 64px */
                                    sm:w-20     /* 80px */
                                    md:w-24     /* 96px */
                                    lg:w-28     /* 112px */
                                    xl:w-32  /* 128px */
                                    2xl:w-48    /* 144px */
                                    h-auto      /* maintain aspect ratio */
                                    "
                                />
                            </div>


                            <div className="text-center lg:text-left">
                                <h1 className={`text-4xl font-bold leading-tight ${theme === 'light' ? 'text-black' : 'text-white'
                                    }`}>
                                    ISP Management Suite
                                </h1>
                                <p className={`text-lg leading-relaxed ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'
                                    }`}>
                                    Streamline your internet services provider operations with our comprehensive ERP solution.
                                </p>
                            </div>

                            {/* Feature Cards - Fixed 3x2 grid for laptop */}
                            <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto lg:mx-0">
                                {features.map((feature, index) => (
                                    <div key={index} className={`bg-white rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer ${theme === 'light' ? 'border border-gray-200' : 'border-0'
                                        }`}>
                                        <div className="flex flex-col items-center text-center space-y-2">
                                            <div className="text-3xl">
                                                {feature.icon}
                                            </div>
                                            <h3 className="font-semibold text-black text-sm">
                                                {feature.title}
                                            </h3>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 text-center lg:text-left">
                                <p className={`text-base ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                                    }`}>
                                    Trusted by ISPs Worldwide for reliable network and business management.
                                </p>
                            </div>
                        </div>

                        {/* Right Section - Login Form */}
                        <div className="flex justify-center lg:justify-end">
                            <div className={`rounded-2xl shadow-2xl p-8 w-full max-w-md ${theme === 'light'
                                ? 'bg-white border border-gray-200'
                                : 'bg-white'
                                }`}>

                                {/* Header with gradient */}
                                <div className="h-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-xl -mx-8 -mt-8 mb-6"></div>

                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-black mb-2">Welcome Back..</h2>
                                    <p className="text-base text-gray-600">Sign in to access your NETRA dashboard</p>
                                </div>

                                <form onSubmit={handleLogin} className="space-y-6">
                                    <div>
                                        <label htmlFor="username" className="block text-sm font-medium text-black mb-2">
                                            Username
                                        </label>
                                        <div className="relative">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <Users className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <input
                                                id="username"
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                placeholder="Enter your username"
                                                className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="password" className="block text-sm font-medium text-black mb-2">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <Lock className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Enter your password"
                                                className="w-full pl-10 pr-12 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-base"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id="remember"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500"
                                            />
                                            <label htmlFor="remember" className="text-sm text-black">
                                                Remember me
                                            </label>
                                        </div>
                                        {/* <button
                                            type="button"
                                            className="text-sm font-semibold text-black hover:text-gray-700"
                                        >
                                            <ForgotPasswordNotice />
                                        </button> */}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`
                                            w-full py-3 rounded-lg font-medium transition-colors text-base
                                            ${loading
                                                ? "cursor-not-allowed text-white " +
                                                (theme === 'dark' ? 'bg-black' : 'bg-orange-400')
                                                : "text-white " +
                                                (theme === 'dark'
                                                    ? 'bg-black hover:bg-gray-800'
                                                    : 'bg-orange-600 hover:bg-orange-700'
                                                )
                                            }
                                        `}
                                    >
                                        {loading ? (
                                            <div className="flex items-center justify-center">
                                                <svg
                                                    className="mr-2 h-4 w-4 animate-spin text-white"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <circle
                                                        className="opacity-25"
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                    />
                                                    <path
                                                        className="opacity-75"
                                                        fill="currentColor"
                                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                    />
                                                </svg>
                                                Logging in...
                                            </div>
                                        ) : (
                                            'Sign In'
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default LoginComponent;