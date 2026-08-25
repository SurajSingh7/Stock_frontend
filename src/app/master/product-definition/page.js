import ProductionDefinition from '@/modules/master/productDefinition/ProductionDefinition'
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <ProductionDefinition/>
        </Suspense>
    </div>
  )
}

export default page
