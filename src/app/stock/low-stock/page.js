import LowStockComp from '@/modules/stock/lowStock/LowStockComp';
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <LowStockComp/>
        </Suspense>
    </div>
  )
}

export default page;
