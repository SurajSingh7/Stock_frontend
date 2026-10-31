import ItemInventory from '@/modules/stock/inventory/ItemInventory';
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <ItemInventory/>
        </Suspense>
    </div>
  )
}

export default page;
