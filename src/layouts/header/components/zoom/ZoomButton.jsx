"use client";

import React, { useState, useRef, useEffect } from "react";
import { Minus, Plus, ZoomIn, Monitor } from "lucide-react";
import { useZoom } from "./ZoomProvider";

/* ================= CONFIG ================= */
const DESIGN_WIDTH = 1920;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 1;
const STEP = 0.05;
/* ========================================= */

const ZoomButtons = ({
  variant = "inline",
  position = "right-center",
}) => {
  const { zoom, setZoom } = useZoom();

  const [open, setOpen] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [screenSize, setScreenSize] = useState({
    width: 0,
    height: 0,
  });

  const ref = useRef(null);

  /* ---------------- AUTO PERFECT ZOOM ---------------- */
  useEffect(() => {
    const applyPerfectZoom = () => {
      const width = window.innerWidth;

      setScreenSize({
        width,
        height: window.innerHeight,
      });

      if (isManual) return;

      let calculatedZoom = width / DESIGN_WIDTH;
      calculatedZoom = Math.max(
        MIN_ZOOM,
        Math.min(calculatedZoom, MAX_ZOOM)
      );

      setZoom(Number(calculatedZoom.toFixed(2)));
    };

    applyPerfectZoom();
    window.addEventListener("resize", applyPerfectZoom);

    return () =>
      window.removeEventListener("resize", applyPerfectZoom);
  }, [isManual, setZoom]);

  /* ---------------- MANUAL CONTROLS ---------------- */
  const zoomIn = () => {
    setIsManual(true);
    setZoom((z) => Math.min(Number((z + STEP).toFixed(2)), MAX_ZOOM));
  };

  const zoomOut = () => {
    setIsManual(true);
    setZoom((z) => Math.max(Number((z - STEP).toFixed(2)), MIN_ZOOM));
  };

  /* ---------------- OUTSIDE CLICK ---------------- */
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const positionClasses = {
    "right-center": "fixed right-4 top-1/2 -translate-y-1/2",
    "bottom-right": "fixed right-4 bottom-4",
    "top-right": "fixed right-4 top-4",
  };

  return (
    <>
    <div>

    </div>

        {/* <div
            ref={ref}
            className={
            variant === "fixed"
                ? `${positionClasses[position]} z-50`
                : "relative"
            }
        >
            <div
            className="
                flex items-center gap-1
                rounded-full
                px-2 py-1
                bg-gradient-to-b from-white to-gray-50
                ring-1 ring-black/5
                shadow-[0_4px_12px_rgba(0,0,0,0.12)]
                backdrop-blur-md
            "
            >
          
            <button
                onClick={() => setOpen((o) => !o)}
                className="p-1 rounded-full hover:bg-black/5 active:scale-95 transition"
                title="Zoom settings"
            >
                <ZoomIn size={14} className="text-gray-700" />
            </button>

            {open && (
                <>
               
                <button
                    onClick={zoomOut}
                    disabled={zoom <= MIN_ZOOM}
                    className="p-1 rounded-full hover:bg-black/5 disabled:opacity-40 active:scale-95 transition"
                    title="Zoom out"
                >
                    <Minus size={12} className="text-gray-700" />
                </button>

               
                <span className="text-[11px] font-semibold text-gray-800 w-10 text-center">
                    {Math.round(zoom * 100)}%
                </span>

               
                <button
                    onClick={zoomIn}
                    disabled={zoom >= MAX_ZOOM}
                    className="p-1 rounded-full hover:bg-black/5 disabled:opacity-40 active:scale-95 transition"
                    title="Zoom in"
                >
                    <Plus size={12} className="text-gray-700" />
                </button>

               
                <span className="mx-1 h-4 w-px bg-gray-300" />

               
                <div
                    className="flex items-center gap-1 text-[10px] font-medium text-gray-700"
                    title="Screen size"
                >
                    <Monitor size={12} />
                    <span>
                    {screenSize.width}×{screenSize.height}
                    </span>
                </div>
                </>
            )}
            </div>
        </div> */}

    </>
  );
};

export default ZoomButtons;



//  for mannual we can set 
// "use client";

// import React, { useState, useRef, useEffect } from "react";
// import { Minus, Plus, ZoomIn } from "lucide-react";
// import { useZoom } from "./ZoomProvider";

// const MIN_ZOOM = 0.8; // 80%
// const MAX_ZOOM = 1; // 100%
// const STEP = 0.05; // 5%

// const ZoomButtons = ({
//   variant = "inline",
//   position = "right-center",
// }) => {
//   const { zoom, setZoom } = useZoom();
//   const [open, setOpen] = useState(false);
//   const ref = useRef(null);

//   const zoomIn = () => setZoom((z) => Math.min(z + STEP, MAX_ZOOM));
//   const zoomOut = () => setZoom((z) => Math.max(z - STEP, MIN_ZOOM));

//   useEffect(() => {
//     const handler = (e) => {
//       if (ref.current && !ref.current.contains(e.target)) {
//         setOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, []);

//   const positionClasses = {
//     "right-center": "fixed right-4 top-1/2 -translate-y-1/2",
//     "bottom-right": "fixed right-4 bottom-4",
//     "top-right": "fixed right-4 top-4",
//   };

//   return (
//     <div
//       ref={ref}
//       className={
//         variant === "fixed"
//           ? `${positionClasses[position]} z-50`
//           : "relative"
//       }
//     >
//       <div
//         className="
//           flex items-center gap-1
//           bg-white/95 backdrop-blur-sm
//           border border-gray-200/60
//           shadow-lg shadow-gray-900/5
//           rounded-full
//           px-2 py-1
//           transition-all duration-300 ease-out
//           hover:shadow-xl hover:shadow-gray-900/10
//           ring-1 ring-black/[0.03]
//         "
//       >
//         {/* Zoom Icon */}
//         <button
//           onClick={() => setOpen((o) => !o)}
//           className="
//             p-1 rounded-full 
//             hover:bg-gray-100/80 
//             active:bg-gray-200/60
//             transition-all duration-200
//             group
//           "
//           title="Zoom"
//         >
//           <ZoomIn 
//             size={14} 
//             className="text-gray-600 group-hover:text-gray-900 transition-colors" 
//             strokeWidth={2.5}
//           />
//         </button>

//         {/* Expanded Controls */}
//         {open && (
//           <>
//             <div className="w-px h-3 bg-gray-200/80" />
            
//             <button
//               onClick={zoomOut}
//               disabled={zoom <= MIN_ZOOM}
//               className="
//                 p-1 rounded-full 
//                 hover:bg-gray-100/80 
//                 active:bg-gray-200/60
//                 disabled:opacity-30 disabled:cursor-not-allowed
//                 transition-all duration-200
//                 group
//               "
//               title="Zoom out"
//             >
//               <Minus 
//                 size={12} 
//                 className="text-gray-600 group-hover:text-gray-900 transition-colors" 
//                 strokeWidth={2.5}
//               />
//             </button>

//             <span className="
//               text-[11px] font-semibold text-gray-700 
//               w-9 text-center 
//               tabular-nums
//               select-none
//             ">
//               {Math.round(zoom * 100)}%
//             </span>

//             <button
//               onClick={zoomIn}
//               disabled={zoom >= MAX_ZOOM}
//               className="
//                 p-1 rounded-full 
//                 hover:bg-gray-100/80 
//                 active:bg-gray-200/60
//                 disabled:opacity-30 disabled:cursor-not-allowed
//                 transition-all duration-200
//                 group
//               "
//               title="Zoom in"
//             >
//               <Plus 
//                 size={12} 
//                 className="text-gray-600 group-hover:text-gray-900 transition-colors" 
//                 strokeWidth={2.5}
//               />
//             </button>
//           </>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ZoomButtons;
