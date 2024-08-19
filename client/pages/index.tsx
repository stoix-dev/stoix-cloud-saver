import DefaultLayout from "../layouts/default";
import React, { useState, useEffect } from "react";
import { Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button, CircularProgress } from "@nextui-org/react";

export default function IndexPage() {

  const [notificationName, setNotificationName] = useState<string>("");
  const [notifications, setNotifications] = useState<any[]>([]); // Use `any[]` if the type of notifications is not predefined
  const [isLoading, setIsLoading] = useState<boolean>(true); // Corrected capitalization on `setIsLoading`

  useEffect(() => {
    fetch("/api/notifications")
      .then(response => response.json())
      .then(data => {
        setNotifications(data.notifications);
        setIsLoading(false);
      });
  }, []);

  const saveNotification = async () => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: notificationName }),
    })
      .then(response => response.json())
      .then(data => {
        setNotifications([...notifications, data]);
        setNotificationName("");
      });
  }

  return (
    isLoading ? (
      <div>
        <CircularProgress />
      </div>
    ) : (
      <DefaultLayout>
        <section className="flex flex-col gap-4 py-8 md:py-10">
          <div className="w-full">
            <h1>Add a new notification:</h1>
          </div>
          <div>
            <div className="flex flex-wrap md:flex-nowrap gap-4 items-center w-3/12">
              <div className="flex-1">
                <Input type="text" label="Write the notification" value={notificationName}
                  onChange={(e) => setNotificationName(e.target.value)} />
              </div>
              <div>
                <Button color="primary" onClick={saveNotification}>
                  Save
                </Button>
              </div>
            </div>
          </div>

          <Table aria-label="Example static collection table">
            <TableHeader>
              <TableColumn>NAME</TableColumn>
            </TableHeader>
            <TableBody>
              {notifications.map((notification, index) => (
                <TableRow key={index}>
                  <TableCell>{notification.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </DefaultLayout>
    )
  );
}
