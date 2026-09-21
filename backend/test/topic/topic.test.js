import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createApp } from "../../src/create-app.js";
import {
  createSessionFixture,
  createUserFixture,
} from "../helpers/auth-fixtures.js";
import { createTestDatabase } from "../helpers/test-database.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";

const ERROR_CODES = {
  validation: "VALIDATION_ERROR",
  missing: "TOPIC_NOT_FOUND",
  duplicate: "TOPIC_NAME_ALREADY_EXISTS",
};

let database;
let prisma;
let http;

before(async () => {
  database = await createTestDatabase();
  prisma = database.prisma;
  http = await startHttpTestServer(createApp({ prisma }));
});

beforeEach(async () => {
  await database.reset();
});

afterEach(async () => {
  await database.reset();
});

after(async () => {
  try {
    if (database) await database.reset();
  } finally {
    try {
      if (http) await http.close();
    } finally {
      if (database) await database.disconnect();
    }
  }
});

test("TOPIC schema has the approved fields, types, nullability, timestamps, and functional unique index", async () => {
  const columns = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, is_nullable, character_maximum_length, column_default
       FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'TOPIC'
      ORDER BY ordinal_position`,
  );
  assert.deepEqual(
    columns.map(({ column_name }) => column_name),
    ["id", "name", "description", "created_at", "updated_at"],
  );
  assert.deepEqual(
    columns.map(({ data_type, is_nullable, character_maximum_length }) => ({
      data_type,
      is_nullable,
      character_maximum_length,
    })),
    [
      { data_type: "uuid", is_nullable: "NO", character_maximum_length: null },
      {
        data_type: "character varying",
        is_nullable: "NO",
        character_maximum_length: 100,
      },
      {
        data_type: "character varying",
        is_nullable: "YES",
        character_maximum_length: 500,
      },
      {
        data_type: "timestamp without time zone",
        is_nullable: "NO",
        character_maximum_length: null,
      },
      {
        data_type: "timestamp without time zone",
        is_nullable: "NO",
        character_maximum_length: null,
      },
    ],
  );
  assert.match(columns[3].column_default, /CURRENT_TIMESTAMP/i);

  const indexes = await prisma.$queryRawUnsafe(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename = 'TOPIC'`,
  );
  const nameIndex = indexes.find(
    ({ indexname }) => indexname === "TOPIC_name_lower_key",
  );
  assert.ok(nameIndex);
  assert.match(nameIndex.indexdef, /CREATE UNIQUE INDEX/i);
  assert.match(nameIndex.indexdef, /lower\(\(name\)::text\)/i);
});

test("PostgreSQL LOWER(name) index is the final case-insensitive uniqueness guard", async () => {
  const firstId = randomUUID();
  const secondId = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "TOPIC" ("id", "name", "description", "created_at", "updated_at")
     VALUES ($1::uuid, $2, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    firstId,
    "DatabaseGuard",
  );

  await assert.rejects(
    prisma.$executeRawUnsafe(
      `INSERT INTO "TOPIC" ("id", "name", "description", "created_at", "updated_at")
       VALUES ($1::uuid, $2, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      secondId,
      "databaseguard",
    ),
  );
  assert.equal(await prisma.tOPIC.count(), 1);
});

test("public list supports an empty database without authentication", async () => {
  const response = await http.request("/api/topics");
  assert.equal(response.status, 200);
  assert.deepEqual(response.json, { success: true, data: [] });
});

test("public list and detail expose only approved Topic metadata", async () => {
  const topic = await prisma.tOPIC.create({
    data: { name: "Public Topic", description: null },
  });

  for (const response of [
    await http.request("/api/topics"),
    await http.request(`/api/topics/${topic.id}`),
  ]) {
    assert.equal(response.status, 200);
    const value = Array.isArray(response.json.data)
      ? response.json.data[0]
      : response.json.data;
    assert.deepEqual(Object.keys(value).sort(), [
      "created_at",
      "description",
      "id",
      "name",
      "updated_at",
    ]);
    assert.match(value.id, /^[0-9a-f-]{36}$/i);
    assert.equal(value.description, null);
    assert.equal(Number.isNaN(Date.parse(value.created_at)), false);
    assert.equal(Number.isNaN(Date.parse(value.updated_at)), false);
  }
});

test("public detail rejects invalid UUID and reports a missing Topic safely", async () => {
  const invalid = await http.request("/api/topics/not-a-uuid");
  const missing = await http.request(`/api/topics/${randomUUID()}`);
  assertError(invalid, 400, ERROR_CODES.validation);
  assertError(missing, 404, ERROR_CODES.missing);
});

test("ADMIN can create, update, and delete a Topic with approved responses", async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const created = await adminRequest("/api/admin/topics", cookie, {
    method: "POST",
    json: { name: "  Daily Life  " },
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.name, "Daily Life");
  assert.equal(created.json.data.description, null);
  assert.match(created.json.data.id, /^[0-9a-f-]{36}$/i);
  assert.equal(Number.isNaN(Date.parse(created.json.data.created_at)), false);
  assert.equal(Number.isNaN(Date.parse(created.json.data.updated_at)), false);

  const updated = await adminRequest(
    `/api/admin/topics/${created.json.data.id}`,
    cookie,
    {
      method: "PATCH",
      json: { name: "  Everyday Life  ", description: "Common words" },
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.name, "Everyday Life");
  assert.equal(updated.json.data.description, "Common words");

  const deleted = await adminRequest(
    `/api/admin/topics/${created.json.data.id}`,
    cookie,
    { method: "DELETE" },
  );
  assert.equal(deleted.status, 204);
  assert.equal(deleted.text, "");
  assert.equal(await prisma.tOPIC.count(), 0);
});

test("create rejects missing, invalid, empty, and overlong names", async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const invalidNames = [undefined, null, 42, "", "   ", "x".repeat(101)];

  for (const name of invalidNames) {
    const json = name === undefined ? {} : { name };
    const response = await adminRequest("/api/admin/topics", cookie, {
      method: "POST",
      json,
    });
    assertError(response, 400, ERROR_CODES.validation);
  }
  assert.equal(await prisma.tOPIC.count(), 0);
});

test("create rejects invalid and overlong descriptions", async () => {
  const cookie = await authenticatedCookie("ADMIN");
  for (const description of [42, {}, "x".repeat(501)]) {
    const response = await adminRequest("/api/admin/topics", cookie, {
      method: "POST",
      json: { name: "Valid Name", description },
    });
    assertError(response, 400, ERROR_CODES.validation);
  }
});

test("PATCH preserves omitted fields and description null clears the value", async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const topic = await prisma.tOPIC.create({
    data: { name: "Original", description: "Original description" },
  });
  const renamed = await adminRequest(`/api/admin/topics/${topic.id}`, cookie, {
    method: "PATCH",
    json: { name: "  Renamed  " },
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.json.data.name, "Renamed");
  assert.equal(renamed.json.data.description, "Original description");

  const cleared = await adminRequest(`/api/admin/topics/${topic.id}`, cookie, {
    method: "PATCH",
    json: { description: null },
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.json.data.name, "Renamed");
  assert.equal(cleared.json.data.description, null);
});

test("PATCH rejects invalid values, invalid UUIDs, and bodies without supported fields", async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const topic = await prisma.tOPIC.create({ data: { name: "Patch Target" } });
  const scenarios = [
    [`/api/admin/topics/${topic.id}`, { name: null }],
    [`/api/admin/topics/${topic.id}`, { name: " " }],
    [`/api/admin/topics/${topic.id}`, { name: "x".repeat(101) }],
    [`/api/admin/topics/${topic.id}`, { description: 12 }],
    [`/api/admin/topics/${topic.id}`, { description: "x".repeat(501) }],
    [`/api/admin/topics/${topic.id}`, {}],
    [`/api/admin/topics/${topic.id}`, { unsupported: true }],
    ["/api/admin/topics/not-a-uuid", { name: "Valid" }],
  ];
  for (const [path, json] of scenarios) {
    const response = await adminRequest(path, cookie, {
      method: "PATCH",
      json,
    });
    assertError(response, 400, ERROR_CODES.validation);
  }
});

test("update and delete report missing Topics", async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const topicId = randomUUID();
  const update = await adminRequest(`/api/admin/topics/${topicId}`, cookie, {
    method: "PATCH",
    json: { name: "Missing" },
  });
  const deletion = await adminRequest(`/api/admin/topics/${topicId}`, cookie, {
    method: "DELETE",
  });
  assertError(update, 404, ERROR_CODES.missing);
  assertError(deletion, 404, ERROR_CODES.missing);
});

test("case-insensitive duplicate create and rename return the stable 409 contract", async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const first = await adminRequest("/api/admin/topics", cookie, {
    method: "POST",
    json: { name: "Travel" },
  });
  const duplicate = await adminRequest("/api/admin/topics", cookie, {
    method: "POST",
    json: { name: "tRaVeL" },
  });
  const other = await prisma.tOPIC.create({ data: { name: "Work" } });
  const rename = await adminRequest(`/api/admin/topics/${other.id}`, cookie, {
    method: "PATCH",
    json: { name: "TRAVEL" },
  });

  assert.equal(first.status, 201);
  assertError(duplicate, 409, ERROR_CODES.duplicate);
  assertError(rename, 409, ERROR_CODES.duplicate);
  assert.equal(await prisma.tOPIC.count(), 2);
});

test("concurrent case variants exercise DB collision translation to one 201 and one 409", async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const responses = await Promise.all([
    adminRequest("/api/admin/topics", cookie, {
      method: "POST",
      json: { name: "Concurrent Topic" },
    }),
    adminRequest("/api/admin/topics", cookie, {
      method: "POST",
      json: { name: "concurrent topic" },
    }),
  ]);

  assert.deepEqual(
    responses.map(({ status }) => status).sort(),
    [201, 409],
  );
  assert.equal(
    responses.find(({ status }) => status === 409).json.error.code,
    ERROR_CODES.duplicate,
  );
  assert.equal(await prisma.tOPIC.count(), 1);
});

test("ADMIN mutations reject missing sessions with existing 401 contract", async () => {
  const response = await http.request("/api/admin/topics", {
    method: "POST",
    json: { name: "Blocked" },
  });
  assertError(response, 401, "AUTHENTICATION_FAILED");
  assert.equal(await prisma.tOPIC.count(), 0);
});

test("USER and forged identity inputs cannot grant ADMIN access", async () => {
  const cookie = await authenticatedCookie("USER");
  const response = await http.request(
    "/api/admin/topics?role=ADMIN&user_id=forged",
    {
      method: "POST",
      cookie,
      headers: { "x-role": "ADMIN", "x-user-id": "forged" },
      json: { name: "Blocked", role: "ADMIN", user_id: "forged" },
    },
  );
  assertError(response, 403, "FORBIDDEN");
  assert.equal(await prisma.tOPIC.count(), 0);
});

test("unexpected failures return safe 500 without internal leakage", async () => {
  const sensitiveValues = [
    "database-credential-value",
    "session-secret-value",
    "database stack trace",
  ];
  const failingPrisma = {
    tOPIC: {
      findMany() {
        throw new Error(sensitiveValues.join(" | "));
      },
    },
  };
  const failingHttp = await startHttpTestServer(createApp({ prisma: failingPrisma }));

  try {
    const response = await failingHttp.request("/api/topics");
    assert.equal(response.status, 500);
    assert.deepEqual(response.json, {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
    for (const value of sensitiveValues) {
      assert.equal(response.text.includes(value), false);
    }
    assert.equal(response.text.includes("stack"), false);
  } finally {
    await failingHttp.close();
  }
});

async function authenticatedCookie(role) {
  const user = await createUserFixture(prisma, {
    role,
    password_hash: "not-used-by-session-authentication",
  });
  const session = await createSessionFixture(prisma, user.id);
  return `session_id=${session.rawToken}`;
}

function adminRequest(path, cookie, options) {
  return http.request(path, { ...options, cookie });
}

function assertError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.json?.success, false);
  assert.equal(response.json?.error?.code, code);
  assert.equal(typeof response.json?.error?.message, "string");
}
