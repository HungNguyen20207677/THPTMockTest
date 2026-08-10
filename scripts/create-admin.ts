import { createInterface } from "node:readline/promises";

import { ZodError } from "zod";

import { disconnectFromDatabase } from "@/lib/db/mongoose";
import { AppError } from "@/lib/errors/app-error";
import { createInitialAdmin } from "@/lib/services/admin-bootstrap.service";
import { createInitialAdminSchema } from "@/lib/validations/user";

function readHiddenInput(prompt: string): Promise<string> {
  const input = process.stdin;
  const output = process.stdout;

  if (!input.isTTY || !output.isTTY) {
    throw new Error(
      "The admin creation script requires an interactive terminal.",
    );
  }

  return new Promise((resolve, reject) => {
    let value = "";
    const wasRaw = input.isRaw;

    const cleanup = () => {
      input.removeListener("data", onData);
      input.setRawMode(wasRaw);
      input.pause();
    };

    const onData = (chunk: string | Buffer) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          cleanup();
          output.write("\n");
          reject(new Error("Admin creation cancelled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          output.write("\n");
          resolve(value);
          return;
        }

        if (character === "\u0008" || character === "\u007f") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write("\b \b");
          }
          continue;
        }

        if (character >= " ") {
          value += character;
          output.write("*");
        }
      }
    };

    output.write(prompt);
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.on("data", onData);
    input.resume();
  });
}

async function promptForAdmin() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "The admin creation script requires an interactive terminal.",
    );
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let fullName: string;
  let username: string;

  try {
    fullName = await readline.question("Họ và tên quản trị viên: ");
    username = await readline.question("Tên đăng nhập: ");
  } finally {
    readline.close();
  }

  const password = await readHiddenInput("Mật khẩu: ");
  const passwordConfirmation = await readHiddenInput("Nhập lại mật khẩu: ");

  if (password !== passwordConfirmation) {
    throw new Error("Mật khẩu xác nhận không khớp.");
  }

  return createInitialAdminSchema.parse({
    fullName,
    username,
    password,
  });
}

async function main(): Promise<void> {
  try {
    const input = await promptForAdmin();
    const admin = await createInitialAdmin(input);
    console.log(`Đã tạo quản trị viên: ${admin.username}`);
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(error.issues.map((issue) => issue.message).join("\n"));
    } else if (error instanceof AppError || error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("Không thể tạo tài khoản quản trị.");
    }

    process.exitCode = 1;
  } finally {
    await disconnectFromDatabase();
  }
}

void main();
