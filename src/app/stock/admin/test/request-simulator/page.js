// 🧪 TEST ONLY — Request Simulator. Remove when the real website is connected.
import RequestSimulator from '@/modules/test/requestSimulator/RequestSimulator';
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <RequestSimulator/>
        </Suspense>
    </div>
  )
}

export default page;
