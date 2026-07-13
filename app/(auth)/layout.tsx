import { requireUnAuth } from '@/modules/authentication/actions';
import React from 'react'

async function AuthLayout({children} : {children : React.ReactNode}) {
  
    await requireUnAuth()
    
  return (
    <div className=''>{children}</div>
  )
}

export default AuthLayout