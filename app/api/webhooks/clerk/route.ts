/* eslint-disable camelcase */
"use strict"; // Correct usage is "use strict", not "use"

import { clerkClient } from "@clerk/nextjs/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { createUser, deleteUser, updateUser } from "@/lib/actions/user.action";

export async function POST(req: Request) {
  // Retrieve the webhook secret from environment variables
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local");
  }

  // Extract headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // Validate headers
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  // Retrieve and stringify the request body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Initialize Svix webhook verification
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return NextResponse.json({ error: "Error verifying webhook" }, { status: 400 });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  try {
    switch (eventType) {
      case "user.created": {
        const { email_addresses, image_url, first_name, last_name, username } = evt.data;

        // Ensure all required fields are defined
        if (!id) {
          throw new Error("User ID is missing from the webhook event");
        }

        const user = {
          clerkId: id, // TypeScript should now recognize this as a string
          email: email_addresses[0].email_address,
          username: username || '', // Ensure username is a string
          firstName: first_name || '', // Ensure firstName is a string
          lastName: last_name || '', // Ensure lastName is a string
          photo: image_url || '', // Ensure photo is a string
        };

        // Create user
        const newUser = await createUser(user);

        // Set public metadata
        if (newUser) {
          await clerkClient.users.updateUserMetadata(id, {
            publicMetadata: {
              userId: newUser._id,
            },
          });
        }

        return NextResponse.json({ message: "OK", user: newUser });
      }

      case "user.updated": {
        const { image_url, first_name, last_name, username } = evt.data;

        const user = {
          firstName: first_name || '', // Ensure firstName is a string
          lastName: last_name || '', // Ensure lastName is a string
          username: username || '', // Ensure username is a string
          photo: image_url || '', // Ensure photo is a string
        };

        // Update user
        const updatedUser = await updateUser(id, user);

        return NextResponse.json({ message: "OK", user: updatedUser });
      }

      case "user.deleted": {
        // Delete user
        const deletedUser = await deleteUser(id);

        return NextResponse.json({ message: "OK", user: deletedUser });
      }

      default: {
        console.log(`Unhandled event type: ${eventType}`);
        return NextResponse.json({ message: "Unhandled event type" }, { status: 400 });
      }
    }
  } catch (error) {
    console.error(`Error processing event ${eventType}:`, error);
    return NextResponse.json({ error: "Error processing event" }, { status: 500 });
  }
}
