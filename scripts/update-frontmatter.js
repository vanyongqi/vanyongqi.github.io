const fs = require("fs");
const path = require("path");

// Markdown 文章目录
const BLOG_DIR = path.join(__dirname, "../src/content/blog");

// 读取所有 Markdown 文件
const files = fs.readdirSync(BLOG_DIR).filter(file => file.endsWith(".md"));

// 获取当前 UTC 时间
const getCurrentUTC = () => new Date().toISOString();

// 遍历 Markdown 文件
files.forEach(file => {
  const filePath = path.join(BLOG_DIR, file);
  let content = fs.readFileSync(filePath, "utf8");

  // 解析 frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return; // 跳过无 frontmatter 的文件

  let frontmatter = frontmatterMatch[1];
  const modDateTimeRegex = /^modDatetime:\s*(.+)$/m;
  const pubDateTimeRegex = /^pubDatetime:\s*(.+)$/m;

  // 获取 pubDatetime（如果没有，则设置为当前时间）
  if (!pubDateTimeRegex.test(frontmatter)) {
    frontmatter += `\npubDatetime: ${getCurrentUTC()}`;
  }

  // 更新 modDatetime 为当前时间
  if (modDateTimeRegex.test(frontmatter)) {
    frontmatter = frontmatter.replace(modDateTimeRegex, `modDatetime: ${getCurrentUTC()}`);
  } else {
    frontmatter += `\nmodDatetime: ${getCurrentUTC()}`;
  }

  // 重新拼接内容
  const newContent = content.replace(/^---\n([\s\S]*?)\n---/, `---\n${frontmatter}\n---`);
  fs.writeFileSync(filePath, newContent, "utf8");

  console.log(`✅ Updated frontmatter for: ${file}`);
});

console.log("✅ All markdown files updated!");
