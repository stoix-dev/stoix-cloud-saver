import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from "uuid"; // Ensure UUID version compatibility

const prisma = new PrismaClient();

type Notification = {
  id: string;
  name: string;
};

type ErrorResponse = {
  error: string;
};

type GetAllResponse = {
  notifications: Notification[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Notification | GetAllResponse | ErrorResponse>
) {
  if (req.method === 'POST') {
    // Create a new notification
    const { name } = req.body;

    try {
      const notification = await prisma.notifications.create({
        data: {
          id: uuidv4(),
          name,
        },
      });
      res.status(200).json({ id: notification.id, name: notification.name });
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(500).json({ error: "Something went wrong" });
    }
  } else if (req.method === 'GET') {
    // Get all notifications
    try {
      const notifications = await prisma.notifications.findMany();
      res.status(200).json({ notifications });
    } catch (error) {
      console.error("Error retrieving notifications:", error);
      res.status(500).json({ error: "Something went wrong" });
    }
  } else {
    // Handle unsupported methods
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
