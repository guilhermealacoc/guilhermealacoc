import fs from "node:fs";
import YAML from "yaml";

const readYaml = (path) => YAML.parse(fs.readFileSync(path, "utf8"));

const profile = readYaml("./profile/profile.yml");
const now = readYaml("./profile/now.yml");
const { projects = [] } = readYaml("./profile/projects.yml");

const allowedTypes = new Set(["product", "professional", "experiment"]);
const allowedStatuses = new Set(["idea", "prototype", "building", "shipped", "completed", "paused", "archived"]);
const errors = [];

if (!profile?.profile?.name) errors.push("profile.profile.name is required");
if (!profile?.profile?.title) errors.push("profile.profile.title is required");
if (!Array.isArray(projects) || projects.length === 0) errors.push("At least one project is required");

const names = new Set();
for (const [index, project] of projects.entries()) {
  const at = `projects[${index}]`;
  if (!project.name) errors.push(`${at}.name is required`);
  if (names.has(project.name)) errors.push(`${at}.name duplicates '${project.name}'`);
  names.add(project.name);

  if (!allowedTypes.has(project.type)) errors.push(`${at}.type must be one of: ${[...allowedTypes].join(", ")}`);
  if (!allowedStatuses.has(project.status)) errors.push(`${at}.status must be one of: ${[...allowedStatuses].join(", ")}`);
  if (!Number.isInteger(project.year)) errors.push(`${at}.year must be an integer`);
  if (!Array.isArray(project.stack)) errors.push(`${at}.stack must be an array`);
}

for (const name of now.building ?? []) {
  if (!names.has(name)) errors.push(`now.building references unknown project '${name}'`);
}

if (errors.length) {
  console.error("Profile data validation failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Profile data OK: ${projects.length} projects validated.`);
