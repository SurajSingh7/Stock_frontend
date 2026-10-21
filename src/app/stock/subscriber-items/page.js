import SubscriberItems from '@/modules/stock/itemRequests/SubscriberItems';
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <SubscriberItems/>
        </Suspense>
    </div>
  )
}

export default page;
