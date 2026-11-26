import EmployeeItems from '@/modules/stock/employeeItems/EmployeeItems';
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <EmployeeItems/>
        </Suspense>
    </div>
  )
}

export default page;
