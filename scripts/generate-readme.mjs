import fs from "node:fs";
import YAML from "yaml";

const readYaml = (path) => YAML.parse(fs.readFileSync(path, "utf8"));
const escapeTable = (value = "") => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");

const profileData = readYaml("./profile/profile.yml");
const now = readYaml("./profile/now.yml");
const { projects = [] } = readYaml("./profile/projects.yml");
const template = fs.readFileSync("./templates/README.template.md", "utf8");

const { profile, links = {}, settings = {} } = profileData;

const typeMeta = {
  product: { label: "Products", description: "Products and independent software projects." },
  professional: { label: "Professional projects", description: "Selected systems developed in a professional context." },
  experiment: { label: "Experiments", description: "Projects built to test an idea, technology or workflow." },
};

const statusLabels = {
  idea: "Idea",
  prototype: "Prototype",
  building: "Building",
  shipped: "Shipped",
  completed: "Completed",
  paused: "Paused",
  archived: "Archived",
};

const publicProjects = settings.show_private_projects === false
  ? projects.filter((project) => project.repository)
  : projects;

function optionalLinks() {
  const items = [];
  if (links.linkedin) items.push(`[LinkedIn](${links.linkedin})`);
  if (links.website) items.push(`[Website](${links.website})`);
  return items.length ? ` · ${items.join(" · ")}` : "";
}

function nowBuilding() {
  const current = new Set(now.building ?? []);
  const active = publicProjects.filter((project) => current.has(project.name));
  if (!active.length) return "No project is currently marked as building.";

  return active.map((project) => {
    const stack = project.stack?.join(" · ") || "";
    const link = project.repository ? ` — [repository](${project.repository})` : "";
    return `**${project.name}** — ${project.description}${link}\n\n<sub>${stack}</sub>`;
  }).join("\n\n");
}

function summary() {
  const order = ["shipped", "building", "prototype", "completed", "paused", "archived", "idea"];
  const counts = Object.fromEntries(order.map((status) => [status, 0]));
  for (const project of publicProjects) counts[project.status] = (counts[project.status] ?? 0) + 1;

  const visible = order.filter((status) => counts[status] > 0);
  const headers = ["Projects", ...visible.map((status) => statusLabels[status])];
  const values = [publicProjects.length, ...visible.map((status) => counts[status])];

  return `| ${headers.join(" | ")} |\n| ${headers.map(() => "---:").join(" | ")} |\n| ${values.join(" | ")} |`;
}

function projectCard(project) {
  const status = statusLabels[project.status] ?? project.status;
  const links = [];
  if (project.repository) links.push(`[Repository](${project.repository})`);
  if (project.demo) links.push(`[Demo](${project.demo})`);

  const features = (project.features ?? []).map((item) => `- ${item}`).join("\n");
  const linkLine = links.length ? `\n\n${links.join(" · ")}` : "";

  return `<details>\n<summary><strong>${project.name}</strong> · ${status} · ${project.year}</summary>\n\n${project.description}\n\n**Problem**  \n${project.problem}\n\n**Approach**  \n${project.solution}\n\n**Stack**  \n${project.stack.join(" · ")}\n\n**Selected features**\n${features || "- —"}${linkLine}\n\n</details>`;
}

function projectSections() {
  return ["product", "professional", "experiment"]
    .map((type) => {
      const items = publicProjects.filter((project) => project.type === type);
      if (!items.length) return "";
      const meta = typeMeta[type];
      return `### ${meta.label}\n\n${meta.description}\n\n${items.map(projectCard).join("\n\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function technologies() {
  if (settings.show_technology_counts === false) return "Technology counts are disabled.";

  const counts = new Map();
  for (const project of publicProjects) {
    for (const tech of new Set(project.stack ?? [])) {
      counts.set(tech, (counts.get(tech) ?? 0) + 1);
    }
  }

  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tech, count]) => `| ${escapeTable(tech)} | ${count} |`)
    .join("\n");

  return `| Technology | Projects |\n| --- | ---: |\n${rows}`;
}

function timeline() {
  if (settings.show_timeline === false) return "Timeline is disabled.";

  const byYear = new Map();
  for (const project of publicProjects) {
    if (!byYear.has(project.year)) byYear.set(project.year, []);
    byYear.get(project.year).push(project);
  }

  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => {
      const lines = items
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((project) => `- **${project.name}** — ${statusLabels[project.status]} · ${project.stack.join(" · ")}`)
        .join("\n");
      return `### ${year}\n\n${lines}`;
    })
    .join("\n\n");
}

function lessonsSection() {
  if (settings.show_lessons === false) return "";
  const items = publicProjects.filter((project) => project.lessons?.trim());
  if (!items.length) return "";

  const content = items
    .map((project) => `### ${project.name}\n\n${project.lessons.trim()}`)
    .join("\n\n");

  return `## Lessons from past projects\n\n${content}\n\n---`;
}

const replacements = {
  "{{PROFILE_NAME}}": profile.name,
  "{{PROFILE_TITLE}}": profile.title,
  "{{PROFILE_SUBTITLE}}": profile.subtitle,
  "{{PROFILE_TAGLINE}}": profile.tagline,
  "{{GITHUB_URL}}": links.github || `https://github.com/${profile.handle}`,
  "{{OPTIONAL_LINKS}}": optionalLinks(),
  "{{NOW_BUILDING}}": nowBuilding(),
  "{{NOW_FOCUS}}": (now.focus ?? []).join(" · "),
  "{{PROJECT_SUMMARY}}": summary(),
  "{{PROJECT_SECTIONS}}": projectSections(),
  "{{TECHNOLOGY_COUNTS}}": technologies(),
  "{{TIMELINE}}": timeline(),
  "{{LESSONS_SECTION}}": lessonsSection(),
  "{{UPDATED_AT}}": now.updated ?? "",
};

let output = template;
for (const [key, value] of Object.entries(replacements)) {
  output = output.replaceAll(key, value ?? "");
}

fs.writeFileSync("./README.md", `${output.trim()}\n`);
console.log(`README.md generated from ${publicProjects.length} projects.`);
