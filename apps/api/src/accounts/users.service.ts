import { Injectable } from "@nestjs/common";
import { hash } from "argon2";
import { DatabaseService } from "../database/database.service";
import { Prisma, type User } from "../generated/prisma/client";

export class EmailRequiredError extends Error {
  constructor() {
    super("Email is required");
    this.name = "EmailRequiredError";
  }
}

export class EmailTakenError extends Error {
  constructor(options?: ErrorOptions) {
    super("A user with this email already exists", options);
    this.name = "EmailTakenError";
  }
}

export class InvalidSuperuserError extends Error {
  constructor(flag: "isStaff" | "isSuperuser") {
    super(`Superuser must have ${flag}=true`);
    this.name = "InvalidSuperuserError";
  }
}

/** One canonical form for every email: trimmed and lowercased, so exact lookups always work. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface CreateUserInput {
  email: string;
  /** null or absent creates an account that cannot log in with a password. */
  password?: string | null;
  firstName?: string;
  lastName?: string;
  isStaff?: boolean;
  isSuperuser?: boolean;
}

/** The port of Django's EmailUserManager: the only code that creates users. */
@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async createUser(input: CreateUserInput): Promise<User> {
    return this.create({ isStaff: false, isSuperuser: false, ...input });
  }

  async createSuperuser(input: CreateUserInput): Promise<User> {
    // Like Django's setdefault plus check: default both flags on, but refuse an explicit false
    // instead of silently overriding it.
    const merged = {
      ...input,
      isStaff: input.isStaff ?? true,
      isSuperuser: input.isSuperuser ?? true,
    };
    if (!merged.isStaff) throw new InvalidSuperuserError("isStaff");
    if (!merged.isSuperuser) throw new InvalidSuperuserError("isSuperuser");
    return this.create(merged);
  }

  /** Login lookup. Emails are stored normalised, so normalising the input is enough. */
  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  private async create({ email, password, ...rest }: CreateUserInput): Promise<User> {
    const normalized = normalizeEmail(email);
    if (normalized === "") throw new EmailRequiredError();

    // argon2id, the hasher OWASP recommends first. It runs on libuv's thread pool, not the
    // event loop, but it is still deliberately slow: never hash inside a hot loop.
    const passwordHash = password == null ? null : await hash(password);

    try {
      return await this.db.user.create({ data: { ...rest, email: normalized, passwordHash } });
    } catch (err) {
      // The unique index decides, not a findUnique before the insert: two concurrent
      // sign-ups would both pass a check, but only one insert can succeed.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new EmailTakenError({ cause: err });
      }
      throw err;
    }
  }
}
