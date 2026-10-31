import StockReports from '@/modules/stock/stockReports/StockReports';
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <StockReports/>
        </Suspense>
    </div>
  )
}

export default page;
