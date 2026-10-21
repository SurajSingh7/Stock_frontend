import OpeningStockList from '@/modules/stock/openingStock/OpeningStockList';
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <OpeningStockList/>
        </Suspense>
    </div>
  )
}

export default page;
