import RepairList from '@/modules/stock/repairs/RepairList';
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <RepairList/>
        </Suspense>
    </div>
  )
}

export default page;
