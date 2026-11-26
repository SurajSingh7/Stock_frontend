'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuthData as fetchHrmsAuth, fetchMyPermissions } from '@/modules/core/auth/authApi';

const PermissionContext = createContext();

export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [branchId, setBranchId] = useState(null);
  // Travels with branchId so a screen can name the user's own branch without
  // calling /branches/active, which needs branches:READ — a permission most
  // staff have no reason to hold.
  const [branchName, setBranchName] = useState("");
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
      const [authResult, permissionResult] = await Promise.allSettled([fetchHrmsAuth(), fetchMyPermissions()]);
      const failures = [authResult, permissionResult].filter((r) => r.status === 'rejected').map((r) => r.reason);

      // Unauthorized
      if (failures.some((e) => e?.status === 403)) {
        router.push('/rostertestingg/error/authorize/');
        return;
      }

      if (failures.length) {
        throw new Error('Failed to fetch user or permissions data');
      }

      const authData = authResult.value;
      const permissionData = permissionResult.value;

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
      setBranchName(permissionData?.data?.branchName || "");
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
        branchName,
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
