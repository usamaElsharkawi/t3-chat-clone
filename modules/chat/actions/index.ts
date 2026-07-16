"use server";

import { prisma } from "@/lib/db";
import { MessageRole, MessageType } from "@/lib/generated/prisma/enums";
import { getCurrentUser } from "@/modules/authentication/actions";
import { revalidatePath } from "next/cache";

export async function createChatWithMessage(content: string, model: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const title = content.slice(0,50)+(content.length>50 ? "..." :"");

    const newChat= await prisma.chat.create({
      data: {
        userId: user?.id,
        title,
        model,
        messages:{
            create:{
                content,
                model,
                messageRole:MessageRole.USER,
                messageType:MessageType.NORMAL,
                
            }
        }
      },
      include:{
        messages:true
      }
    });

    revalidatePath("/","page")
    return { success: true, data:newChat };
  } catch (error) {
    return { success: false, error: "Failed to create chat" };
  }
}


export async function getAllChats(){
    try{
      const user = await getCurrentUser();
      if(!user){
        return {success:false, error:"Unauthorized"}
      }
      const chats = await prisma.chat.findMany({
        where:{
          userId:user?.id
        },
        include:{
            messages:true
        },
        orderBy:{
          updatedAt:"desc"
        }
      })
    
      return {success:true, data:chats}

    }catch(error){
      return {success:false, error:"Failed to get chats"}
    }
}


export async function getChatById(chatId:string){
  try{
    const user = await getCurrentUser();
    if(!user){
      return {success:false, error:"Unauthorized"}
    }
    const chat = await prisma.chat.findUnique({
      where:{
        id:chatId,
        userId:user?.id
      },
      include:{
        messages:true
      }
    })
    
    return {success:true, data:chat}
  }catch(error){
    return {success:false, error:"Failed to get chat"}
  }
}


export async function deleteChat(chatId:string){
  try{
    const user = await getCurrentUser();
    if(!user){
      return {success:false, error:"Unauthorized"}
    }
    const chat = await prisma.chat.delete({
      where:{
        id:chatId,
        userId:user?.id
      }
    })
    
    if(!chat){
      return {success:false, error:"Chat not found"}
    }


    revalidatePath("/")
    return {success:true}
  }catch(error){
    return {success:false, error:"Failed to delete chat"}
  }
}