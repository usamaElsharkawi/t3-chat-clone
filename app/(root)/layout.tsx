import Header from '@/components/header';
import { requireAuth } from '@/modules/authentication/actions'
import ChatSidebar from '@/modules/chat/components/sidebar';
import React from 'react'


async function Layout({children} : {children : React.ReactNode}) {
   const session = await requireAuth();

   return (
    <div className='flex h-screen overflow-hidden'>
      <ChatSidebar user={session.user}/> 
      <main className='flex-1 overflow-hidden'> 
        <Header/>
        {children} 
        </main>
    </div>
  )
}

export default Layout
