import React from 'react'

const Footer = () => {
    return (
        <footer className="bg-gray-100 py-4 text-gray-700 mt-10">
            <p className="text-center text-sm font-bold">
                © 2009-{new Date().getFullYear()} Powered By <span className="font-medium text-blue-500">Gigantic Soft System</span>. All Rights Reserved.
            </p>
        </footer>
    )
}

export default Footer