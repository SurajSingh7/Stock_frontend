'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BACKEND_URL, API_PORTAL_BACKEND_URL } from '@/config/getEnvVariables';

const PermissionContext = createContext();

export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [branchId, setBranchId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const router = useRouter();

  const fetchAuthData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Identity comes from HRMS; effective module permissions (role default
      // + user overrides + branch scope, already resolved server-side) come
      // from this app's own backend — see stock-backend's
      // access-control-controller.getMyPermissions.
      const [authRes, permissionRes] = await Promise.all([
        fetch(`${API_PORTAL_BACKEND_URL}/hrms/authdata`, {
          method: 'GET',
          credentials: 'include',
        }),
        fetch(`${API_BACKEND_URL}/stock/access-control/my-permissions`, {
          method: 'GET',
          credentials: 'include',
        }),
      ]);

      // Unauthorized
      if (authRes.status === 403 || permissionRes.status === 403) {
        router.push('/rostertestingg/error/authorize/');
        return;
      }

      if (!authRes.ok || !permissionRes.ok) {
        throw new Error('Failed to fetch user or permissions data');
      }

      const authData = await authRes.json();
      const permissionData = await permissionRes.json();

      // ============================
      // User Data
      // ============================
      if (authData?.data?.user) {
        const {
          email,
          department,
          basicemployees,
          role,
          departmentOfficialNumber,
        } = authData.data.user;

        setUserData({
          email,
          departmentOfficialNumber,
          department: department?.name,
          role: role?.name,
          firstName: basicemployees?.firstName,
          lastName: basicemployees?.lastName,
          employeeCode: basicemployees?.employeeCode,
          profileImage: `https://api.dicebear.com/5.x/initials/svg?seed=${
            basicemployees?.firstName || ''
          } ${basicemployees?.lastName || ''}`,
        });
      } else {
        setUserData(null);
      }

      // ============================
      // Permissions
      // ============================
      setPermissions(permissionData?.data?.modules || []);
      setIsAdmin(Boolean(permissionData?.data?.isAdmin));
      setBranchId(permissionData?.data?.branchId || null);
    } catch (err) {
      console.error('Auth Fetch Error:', err);

      setError(err.message || 'Something went wrong');

      setUserData(null);
      setPermissions([]);
      setIsAdmin(false);
      setBranchId(null);

      if (err.message?.includes('401')) {
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const clearAuthData = () => {
    setPermissions([]);
    setIsAdmin(false);
    setBranchId(null);
    setUserData(null);
  };

  useEffect(() => {
    fetchAuthData();
  }, []);

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        isAdmin,
        branchId,
        userData,
        loading,
        error,
        refreshAuthData: fetchAuthData,
        clearAuthData,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionContext);














// 'use client';
// import { createContext, useContext, useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import { API_BACKEND_URL, API_PORTAL_BACKEND_URL } from '@/config/getEnvVariables';

// const PermissionContext = createContext();

// export const PermissionProvider = ({ children }) => {
//   const [permissions, setPermissions] = useState([]);
//   const [userData, setUserData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const router = useRouter();

//   const fetchAuthData = async () => {
//     try {
//       setLoading(true);
//       setError(null);

//       // --- Parallel fetch for both APIs ---
//       const [authRes, permissionRes] = await Promise.all([
//         fetch(`${API_PORTAL_BACKEND_URL}/hrms/authdata`, {
//           method: 'GET',
//           credentials: 'include',
//         }),
//         fetch(`${API_BACKEND_URL}/users/permissions`, {
//           method: 'GET',
//           credentials: 'include',
//         }),
//       ]);

//       // --- Handle unauthorized or forbidden ---
//       if (authRes.status === 403 || permissionRes.status === 403) {
//         router.push('/rostertestingg/error/authorize/');
//         return;
//       }

//       if (!authRes.ok || !permissionRes.ok) {
//         throw new Error('Failed to fetch user or permissions data');
//       }

//       const [authData, permissionData] = await Promise.all([
//         authRes.json(),
//         permissionRes.json(),
//       ]);

//       // --- Extract userData ---
//       if (authData?.data?.user) {
//         const {
//           email,
//           department,
//           basicemployees,
//           role,
//           departmentOfficialNumber,
//         } = authData.data.user;

//         setUserData({
//           email,
//           departmentOfficialNumber,
//           department: department?.name,
//           role: role?.name,
//           firstName: basicemployees?.firstName,
//           lastName: basicemployees?.lastName,
//           employeeCode: basicemployees?.employeeCode,
//           profileImage: `https://api.dicebear.com/5.x/initials/svg?seed=${
//             basicemployees?.firstName
//           } ${basicemployees?.lastName}`,
//         });
//       } else {
//         setUserData(null);
//       }

//       // --- Extract permissions ---
//       if (permissionData?.data?.modules) {
//         setPermissions(permissionData.data.modules);
//       } else {
//         setPermissions([]);
//       }
//     } catch (err) {
//       console.error('Auth Fetch Error:', err);
//       setError(err.message || 'Something went wrong');

//       if (err.message.includes('401')) {
//         router.push('/');
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   const clearAuthData = () => {
//     setPermissions([]);
//     setUserData(null);
//   };

//   useEffect(() => {
//     fetchAuthData();
//   }, []);

//   return (
//     <PermissionContext.Provider
//       value={{
//         permissions,
//         userData,
//         loading,
//         error,
//         refreshAuthData: fetchAuthData,
//         clearAuthData,
//       }}
//     >
//       {children}
//     </PermissionContext.Provider>
//   );
// };

// export const usePermissions = () => useContext(PermissionContext);




