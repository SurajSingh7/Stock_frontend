import ItemRequestList from '@/modules/stock/itemRequests/ItemRequestList';
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <ItemRequestList/>
        </Suspense>
    </div>
  )
}

export default page;
