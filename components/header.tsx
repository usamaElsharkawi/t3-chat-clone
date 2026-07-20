
import React from 'react'
import { ModeToggle } from './mode-toggle'

const Header = () => {
  return (
    <div className="flex h-14 w-full flex-row justify-end items-center border-b border-border bg-background/80 backdrop-blur-sm px-4 py-2 sticky top-0 z-10">
      <ModeToggle />
    </div>
  )
}

export default Header