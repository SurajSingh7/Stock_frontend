import ProductInventory from '@/modules/stock/inventory/ProductInventory';
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <ProductInventory/>
        </Suspense>
    </div>
  )
}

export default page;
