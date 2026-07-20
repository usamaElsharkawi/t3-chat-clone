import Header from '@/components/header';
import { requireAuth } from '@/modules/authentication/actions'
import ChatSidebar from '@/modules/chat/components/sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import React from 'react'


async function Layout({children} : {children : React.ReactNode}) {
   const session = await requireAuth();

   return (
    <SidebarProvider defaultOpen={true}>
      <ChatSidebar user={session.user}/> 
      <SidebarInset>
        <Header/>
        {children} 
      </SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
