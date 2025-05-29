const fs = require("fs");
const path = require("path");

// Read the base schema (generator and datasource) from schema.prisma
const base = fs
  .readFileSync(path.join(__dirname, "schema.prisma"), "utf8")
  .split("\n\nmodel")[0]; // Extract everything before the first model

const modelsDir = path.join(__dirname, "models");
const modelFiles = fs
  .readdirSync(modelsDir)
  .filter((f) => f.endsWith(".prisma"));

const models = modelFiles
  .map((f) => fs.readFileSync(path.join(modelsDir, f), "utf8"))
  .join("\n\n");

// 스키마 파일 업데이트
fs.writeFileSync(path.join(__dirname, "schema.prisma"), base + "\n\n" + models);

console.info("schema.prisma has been updated!");
