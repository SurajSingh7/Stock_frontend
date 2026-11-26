import Category from '@/modules/master/category/Category';
import React, { Suspense } from 'react'

const page = () => {
  return (
    <div>
        <Suspense fallback={null}>
          <Category/>
        </Suspense>
    </div>
  )
}

export default page;
