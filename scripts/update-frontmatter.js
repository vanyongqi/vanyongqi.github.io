const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function getGitTimestamp(filePath, type) {
  try {
    const command =
      type === "created"
        ? `git log --diff-filter=A --follow --format=%aI -1 -- "${filePath}"`
        : `git log -1 --format=%aI -- "${filePath}"`;

    return execSync(command).toString().trim();
  } catch (error) {
    console.error(`Error getting ${type} timestamp for ${filePath}:`, error);
    return null;
  }
}

function updateFrontmatter(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    console.error(`No frontmatter found in: ${filePath}`);
    return;
  }

  let frontmatter = match[1];
  const createdAt = getGitTimestamp(filePath, "created");
  const modifiedAt = getGitTimestamp(filePath, "modified");

  // 替换 pubDatetime，如果没有就添加
  if (/^pubDatetime:/m.test(frontmatter)) {
    frontmatter = frontmatter.replace(
      /^pubDatetime: .*/m,
      `pubDatetime: ${createdAt}`
    );
  } else {
    frontmatter += `\npubDatetime: ${createdAt}`;
  }

  // 替换 modDatetime
  if (/^modDatetime:/m.test(frontmatter)) {
    frontmatter = frontmatter.replace(
      /^modDatetime: .*/m,
      `modDatetime: ${modifiedAt}`
    );
  } else {
    frontmatter += `\nmodDatetime: ${modifiedAt}`;
  }

  // 重新拼装 Markdown 文件
  const updatedContent =
    `---\n${frontmatter.trim()}\n---\n` + content.replace(match[0], "").trim();

  fs.writeFileSync(filePath, updatedContent, "utf8");
  console.log(`Updated frontmatter for: ${filePath}`);
}

// 获取 Git 暂存区的 Markdown 文件
const stagedFiles = execSync("git diff --cached --name-only -- '*.md'")
  .toString()
  .trim()
  .split("\n")
  .filter(Boolean);

stagedFiles.forEach(updateFrontmatter);

// 重新添加修改后的文件到 Git 暂存区
if (stagedFiles.length > 0) {
  execSync(`git add ${stagedFiles.join(" ")}`);
  console.log("Updated files added back to Git staging.");
}
