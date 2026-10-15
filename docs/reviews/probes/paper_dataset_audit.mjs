import fs from "node:fs"
import readline from "node:readline"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Run: node docs/reviews/probes/paper_dataset_audit.mjs
// Table 4 of docs/specs/DeTaiJavaNangCao.pdf; does not call the application's parser.
const root = fileURLToPath(new URL("../../../", import.meta.url))
const reports = []
for (const [dataset, expectedTransactions, expectedItems, expectedAverage] of [
  ["Retail", 88162, 16470, 10.3], ["Accidents", 340183, 468, 33.8],
]) {
  const unique = new Set()
  let transactionCount = 0, totalLength = 0, invalidTotal = 0, duplicates = 0, negativeUtility = 0
  const outer = path.join(root, `${dataset}-metadata`)
  const directory = fs.existsSync(path.join(outer, "transactions.txt")) ? outer : path.join(outer, `${dataset}-metadata`)
  const input = fs.createReadStream(path.join(directory, "transactions.txt"))
  for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
    if (!line.trim()) continue
    const [itemText, total, utilityText] = line.split(":")
    const ids = itemText.trim().split(/\s+/)
    const utilities = (utilityText ?? "").trim().split(/\s+/).map(Number)
    ids.forEach(id => unique.add(id)); transactionCount++; totalLength += ids.length
    if (ids.length !== utilities.length || !utilities.every(Number.isFinite)
      || utilities.reduce((a,b) => a+b,0) !== Number(total)) invalidTotal++
    if (new Set(ids).size !== ids.length) duplicates++
    if (utilities.some(value => value < 0)) negativeUtility++
  }
  const averageLength = totalLength / transactionCount
  const matchesPaperTable4 = transactionCount === expectedTransactions && unique.size === expectedItems
    && Number(averageLength.toFixed(1)) === expectedAverage
  const report = { dataset, transactionCount, itemCount: unique.size, averageLength,
    matchesPaperTable4, invalidTotal, duplicates, negativeUtility }
  reports.push(report); console.log(JSON.stringify(report))
  if (!matchesPaperTable4 || invalidTotal || duplicates || negativeUtility) process.exitCode = 1
}
fs.writeFileSync(path.join(root, "docs/reviews/paper-dataset-audit.json"), JSON.stringify(reports, null, 2) + "\n")
