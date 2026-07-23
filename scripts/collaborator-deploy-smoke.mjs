#!/usr/bin/env node

const baseUrl = normalizeBaseUrl(
  process.env.COLLABORATOR_SMOKE_BASE_URL ?? "https://wisconsincreative.com",
);
const email = process.env.COLLABORATOR_SMOKE_EMAIL?.trim().toLowerCase() ?? "";
const password = process.env.COLLABORATOR_SMOKE_PASSWORD ?? "";
const expectedAffiliation = process.env.COLLABORATOR_SMOKE_EXPECTED_AFFILIATION?.trim() ?? "";

if (!email || !password) {
  fail("Set COLLABORATOR_SMOKE_EMAIL and COLLABORATOR_SMOKE_PASSWORD for a disposable collaborator account");
}

const results = [];

main().catch((error) => {
  console.error(`collaborator smoke failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  console.log(`Collaborator smoke target: ${baseUrl.origin}`);
  const cookie = await login();
  const me = await getJson("/api/me", cookie);
  const actor = me.user;

  assert(actor?.role === "COLLABORATOR", `/api/me returned role ${String(actor?.role)}`);
  assert(Array.isArray(actor.capabilities), "/api/me did not return capabilities");
  assert(actor.capabilities.includes("PEOPLE_DIRECTORY_VIEW"), "People directory capability is missing");
  if (expectedAffiliation) {
    const affiliation = actor.collaboratorPolicy?.affiliationKey ?? actor.affiliation;
    assert(
      affiliation === expectedAffiliation,
      `expected affiliation ${expectedAffiliation}, received ${String(affiliation)}`,
    );
  }
  results.push(["/api/me", "ok", "active collaborator policy and People capability"]);

  const list = await getJson("/api/users?limit=100&active=all&includeHidden=1&sort=email", cookie);
  assert(Array.isArray(list.data), "People directory did not return a data array");
  assert(list.data.length > 0, "People directory returned no visible teammates");
  for (const person of list.data) {
    assertDirectoryPerson(person);
  }
  results.push(["/api/users", "ok", `${list.data.length} active visible profiles are minimized`]);

  const other = list.data.find((person) => person.id !== actor.id);
  assert(other, "People directory needs another visible user for detail privacy proof");
  const detail = await getJson(`/api/users/${encodeURIComponent(other.id)}`, cookie);
  assertDirectoryPerson(detail.data);
  assert(detail.data.createdAt === null, "detail exposed membership date");
  assert(detail.data.personalPhone === null, "detail exposed personal phone");
  assert(detail.data.workPhone === null, "detail exposed work phone");
  assert(detail.data.wiscardNumber === null, "detail exposed Wiscard value");
  assert(detail.data.athleticsEmail === null, "detail exposed Athletics email");
  assert(detail.data.directReport === null, "detail exposed reporting structure");
  assert(emptyArray(detail.data.areaAssignments), "detail exposed area assignments");
  results.push([`/api/users/${other.id}`, "ok", "cross-user detail is minimized"]);

  for (const path of [
    "/api/licenses",
    "/api/reports/utilization",
    "/api/settings/reservation-rules",
    `/api/users/${encodeURIComponent(other.id)}/activity`,
  ]) {
    await expectStatus(path, cookie, 403);
  }

  printResults();
}

async function login() {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl.origin,
    },
    body: JSON.stringify({ email, password, rememberMe: false }),
    redirect: "manual",
  });
  if (response.status !== 200) {
    throw new Error(`login returned ${response.status}: ${(await response.text()).slice(0, 160)}`);
  }
  const cookie = readSetCookie(response.headers);
  assert(cookie, "login did not return a session cookie");
  results.push(["/api/auth/login", "ok", "disposable collaborator authenticated"]);
  return cookie;
}

async function getJson(path, cookie) {
  const response = await request(path, { headers: { cookie } });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${(await response.text()).slice(0, 160)}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  assert(contentType.includes("application/json"), `${path} did not return JSON`);
  return response.json();
}

async function expectStatus(path, cookie, expectedStatus) {
  const response = await request(path, { headers: { cookie } });
  assert(response.status === expectedStatus, `${path} returned ${response.status}, expected ${expectedStatus}`);
  results.push([path, "ok", `denied with ${expectedStatus}`]);
}

function assertDirectoryPerson(person) {
  assert(person && typeof person === "object", "directory returned an invalid profile");
  assert(typeof person.id === "string" && person.id.length > 0, "directory profile is missing id");
  assert(typeof person.name === "string" && person.name.length > 0, "directory profile is missing name");
  assert(person.active === true, `${person.id} is not active`);
  assert(person.hiddenFromRoster === false, `${person.id} is hidden`);
  assert(person.email === "", `${person.id} exposed email`);
  assert(person.phone === null, `${person.id} exposed phone`);
  assert(person.slackHandle === null, `${person.id} exposed Slack handle`);
  assert(person.slackProfileUrl === null, `${person.id} exposed Slack profile`);
  assert(person.lastActiveAt === null || person.lastActiveAt === undefined, `${person.id} exposed presence`);
  assert(emptyArray(person.sportAssignments), `${person.id} exposed sport assignments`);
}

function emptyArray(value) {
  return Array.isArray(value) && value.length === 0;
}

function request(path, options = {}) {
  return fetch(new URL(path, baseUrl), options);
}

function readSetCookie(headers) {
  const cookies = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie")].filter(Boolean);
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

function normalizeBaseUrl(value) {
  try {
    const url = new URL(value);
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    throw new Error("COLLABORATOR_SMOKE_BASE_URL is not a valid URL");
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fail(message) {
  console.error(`collaborator smoke failed: ${message}`);
  process.exit(1);
}

function printResults() {
  for (const [target, status, detail] of results) {
    console.log(`${status.padEnd(7)} ${target} - ${detail}`);
  }
}
